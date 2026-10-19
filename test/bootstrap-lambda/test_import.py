"""Unit tests of the bootstrap Lambda's SQL dump tokenizer (no AWS, no MySQL).

Run by `test/bootstrap-lambda.test.ts` (jest) through `python3 -m unittest`.
"""

import importlib.util
import pathlib
import sys
import unittest

HANDLER = pathlib.Path(__file__).resolve().parents[2] / "src" / "stacks" / "data" / "bootstrap-lambda" / "index.py"
spec = importlib.util.spec_from_file_location("bootstrap_index", HANDLER)
index = importlib.util.module_from_spec(spec)
sys.modules["bootstrap_index"] = index
spec.loader.exec_module(index)


def split(dump, chunk_size=None):
    """Statements of `dump` (bytes or str), fed whole or in `chunk_size` chunks."""
    data = dump.encode("utf-8") if isinstance(dump, str) else dump
    if chunk_size is None:
        chunks = [data]
    else:
        chunks = [data[i:i + chunk_size] for i in range(0, len(data), chunk_size)]
    return list(index.iter_statements(chunks))


MYSQLDUMP = """-- MySQL dump 10.13  Distrib 8.4.11, for Linux (x86_64)
--
-- Host: localhost    Database: dev
-- ------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!50503 SET NAMES utf8mb4 */;

--
-- Table structure for table `pages`
--

DROP TABLE IF EXISTS `pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
CREATE TABLE `pages` (
  `uid` int unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL DEFAULT '', -- not a comment: inside the statement? no, it is one
  `note` text COMMENT 'ends with ; here',
  PRIMARY KEY (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `pages` WRITE;
/*!40000 ALTER TABLE `pages` DISABLE KEYS */;
INSERT INTO `pages` VALUES (1,'a; b','x\\'y;\\nz'),(2,'it''s','-- not a comment; /* nor this */');
/*!40000 ALTER TABLE `pages` ENABLE KEYS */;
UNLOCK TABLES;
# a hash comment; with a semicolon
/* a block comment;
   spanning lines */ INSERT INTO `pages` VALUES (3,"double \\"quoted\\"; value",'');

-- Dump completed on 2026-10-08 19:02:35
"""


class IterStatementsTest(unittest.TestCase):
    def test_splits_mysqldump_output(self):
        statements = split(MYSQLDUMP)
        kinds = [index.statement_kind(index.executable_sql(s)) for s in statements]
        self.assertEqual(kinds, [
            "SET", "SET", "DROP", "SET", "CREATE TABLE", "SET", "LOCK", "ALTER", "INSERT", "ALTER", "UNLOCK", "INSERT",
        ])

    def test_semicolons_inside_strings_and_comments_do_not_split(self):
        statements = split(MYSQLDUMP)
        inserts = [s for s in statements if s.startswith(b"INSERT")]
        self.assertEqual(len(inserts), 2)
        self.assertIn(b"'a; b'", inserts[0])
        self.assertIn(b"'x\\'y;\\nz'", inserts[0])
        self.assertIn(b"'it''s'", inserts[0])
        self.assertIn(b"'-- not a comment; /* nor this */'", inserts[0])
        self.assertIn(b'"double \\"quoted\\"; value"', inserts[1])
        create = next(s for s in statements if s.startswith(b"CREATE TABLE"))
        self.assertIn(b"COMMENT 'ends with ; here'", create)
        self.assertTrue(create.endswith(b"COLLATE=utf8mb4_unicode_ci"))

    def test_leading_comments_are_removed_and_comment_only_statements_dropped(self):
        statements = split(MYSQLDUMP)
        self.assertTrue(statements[0].startswith(b"/*!40101 SET"))
        for statement in statements:
            self.assertFalse(statement.startswith(b"--"), statement[:40])
            self.assertFalse(statement.startswith(b"#"), statement[:40])
        self.assertTrue(statements[-1].startswith(b"INSERT INTO `pages` VALUES (3,"))

    def test_conditional_comments_are_unwrapped_for_execution(self):
        sql = index.executable_sql(b"/*!50503 SET NAMES utf8mb4 */")
        self.assertEqual(sql, b"SET NAMES utf8mb4")
        self.assertEqual(index.statement_kind(sql), "SET")
        # A statement that merely starts with a conditional comment is sent as is.
        sql = index.executable_sql(b"/*!50001 CREATE ALGORITHM=UNDEFINED */ /*!50013 DEFINER=`x`@`%` */ VIEW `v` AS select 1")
        self.assertTrue(sql.startswith(b"/*!50001 CREATE"))

    def test_chunk_boundaries_do_not_change_the_result(self):
        reference = split(MYSQLDUMP)
        for size in (1, 2, 3, 5, 7, 11, 64, 1000):
            self.assertEqual(split(MYSQLDUMP, size), reference, f"chunk size {size}")

    def test_delimiter_command_and_trigger(self):
        dump = (
            "DELIMITER ;;\n"
            "/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `t` BEFORE INSERT ON `pages`\n"
            "FOR EACH ROW BEGIN\n  SET NEW.title = 'x;';\nEND */;;\n"
            "DELIMITER ;\n"
            "INSERT INTO `pages` VALUES (4,'after');\n"
        )
        reference = split(dump)
        self.assertEqual(len(reference), 2)
        self.assertIn(b"TRIGGER `t`", reference[0])
        self.assertTrue(reference[0].endswith(b"END */"))
        self.assertEqual(reference[1], b"INSERT INTO `pages` VALUES (4,'after')")
        for size in (1, 4, 9, 50):
            self.assertEqual(split(dump, size), reference, f"chunk size {size}")

    def test_statement_without_trailing_delimiter_is_returned(self):
        self.assertEqual(split("SELECT 1"), [b"SELECT 1"])
        self.assertEqual(split("SELECT 1;\n-- trailing comment only\n"), [b"SELECT 1"])

    def test_binary_bytes_are_preserved(self):
        raw = b"INSERT INTO `b` VALUES (1,'\x80\xff\x00\\'\\\\;');\n"
        statements = split(raw)
        self.assertEqual(statements, [raw[:-2]])
        for size in (1, 3, 8):
            self.assertEqual(split(raw, size), statements)

    def test_backtick_identifiers_may_contain_semicolons(self):
        statements = split("CREATE TABLE `odd;name` (`a;b` int);\nSELECT 1;")
        self.assertEqual(len(statements), 2)
        self.assertEqual(index.created_table(statements[0]), "odd;name")


class ClassificationTest(unittest.TestCase):
    def test_created_table(self):
        self.assertEqual(index.created_table(b"CREATE TABLE `be_users` (\n `uid` int)"), "be_users")
        self.assertEqual(index.created_table(b"CREATE TABLE IF NOT EXISTS `dev`.`pages` (x int)"), "pages")
        self.assertEqual(index.created_table(b"create table pages (x int)"), "pages")
        self.assertIsNone(index.created_table(b"DROP TABLE IF EXISTS `pages`"))
        self.assertIsNone(index.created_table(b"INSERT INTO `pages` VALUES (1)"))

    def test_skipped_statements(self):
        self.assertIsNotNone(index.skip_reason(b"SET @@GLOBAL.GTID_PURGED='x'"))
        self.assertIsNotNone(index.skip_reason(index.executable_sql(b"/*!80000 SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ 'abc' */")))
        self.assertIsNotNone(index.skip_reason(b"SET @@SESSION.SQL_LOG_BIN= 0"))
        self.assertIsNotNone(index.skip_reason(b"CREATE DATABASE /*!32312 IF NOT EXISTS*/ `dev`"))
        self.assertIsNotNone(index.skip_reason(b"USE `dev`"))
        self.assertIsNone(index.skip_reason(b"SET NAMES utf8mb4"))
        self.assertIsNone(index.skip_reason(b"SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO'"))
        self.assertIsNone(index.skip_reason(b"INSERT INTO `t` VALUES ('USE x')"))

    def test_statement_kind(self):
        self.assertEqual(index.statement_kind(b"CREATE TABLE `t` (x int)"), "CREATE TABLE")
        self.assertEqual(index.statement_kind(b"INSERT INTO `t` VALUES (1)"), "INSERT")
        self.assertEqual(index.statement_kind(b"/*!40000 ALTER TABLE `t` DISABLE KEYS */"), "OTHER")
        self.assertEqual(index.statement_kind(index.executable_sql(b"/*!40000 ALTER TABLE `t` DISABLE KEYS */")), "ALTER")


class ImportDumpTest(unittest.TestCase):
    """`import_dump` against a fake connection: what is executed, counted and skipped."""

    class FakeCursor:
        def __init__(self, log):
            self.log = log

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def execute(self, sql, args=None):
            self.log.append(sql if isinstance(sql, bytes) else sql.encode())

    class FakeConnection:
        def __init__(self):
            self.executed = []

        def cursor(self):
            return ImportDumpTest.FakeCursor(self.executed)

    class Body:
        def __init__(self, data):
            self.data = data
            self.pos = 0

        def read(self, n):
            chunk = self.data[self.pos:self.pos + n]
            self.pos += n
            return chunk

    def test_executes_everything_but_the_refused_statements(self):
        dump = (
            MYSQLDUMP
            + "/*!80000 SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ 'abc' */;\n"
            + "CREATE DATABASE `dev`;\nUSE `dev`;\n"
        ).encode()
        connection = self.FakeConnection()
        logs = []
        summary = index.import_dump(connection, "target", self.Body(dump), log=logs.append)
        self.assertEqual(summary["tables"], ["pages"])
        self.assertEqual(summary["counts"]["CREATE TABLE"], 1)
        self.assertEqual(summary["counts"]["INSERT"], 2)
        self.assertEqual(len(summary["skipped"]), 3)
        self.assertEqual(len([l for l in logs if l.startswith("SKIPPED")]), 3)
        executed = connection.executed
        self.assertEqual(executed[0], b"USE `target`")
        self.assertIn(b"SET NAMES utf8mb4", executed)
        self.assertNotIn(b"USE `dev`", executed)
        self.assertNotIn(b"CREATE DATABASE `dev`", executed)
        self.assertFalse(any(b"GTID_PURGED" in e for e in executed))
        self.assertEqual(executed[-1], b"SET SESSION FOREIGN_KEY_CHECKS = 1")


if __name__ == "__main__":
    unittest.main()
