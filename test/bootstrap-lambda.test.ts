import { spawnSync } from 'child_process';
import * as path from 'path';

/**
 * The bootstrap Lambda's SQL tokenizer is Python: its unit tests live in
 * `test/bootstrap-lambda/` and run through `python3 -m unittest`.
 */
test('bootstrap Lambda tokenizer unit tests pass', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', path.join(__dirname, 'bootstrap-lambda'), '-p', 'test_*.py'], {
    encoding: 'utf-8',
  });
  if (result.error) {
    throw result.error;
  }
  expect(result.stderr + result.stdout).toContain('OK');
  expect(result.status).toBe(0);
});
