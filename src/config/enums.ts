/**
 * ECS container layout of the web application.
 */
export enum ContainerTopology {
  /**
   * One `web` container running Apache and PHP (php-apache image).
   */
  SINGLE = 'SINGLE',
  /**
   * A `web` container running tm-apache and a `php-fpm` container running
   * tm-php-fpm, both in the same ECS task.
   */
  APACHE_PHP_FPM = 'APACHE_PHP_FPM',
  /**
   * A `web` container running nginx and a `php-fpm` container, both in the
   * same ECS task.
   */
  NGINX_PHP_FPM = 'NGINX_PHP_FPM',
}

/**
 * Where TYPO3 stores its FAL files (`fileadmin`).
 */
export enum FalStorage {
  /**
   * A content bucket, read by TYPO3 with the `TM_S3ASSETS_*` variables.
   */
  S3 = 'S3',
  /**
   * EFS volumes mounted in the containers.
   */
  EFS = 'EFS',
}

/**
 * Value format of the distribution-ID parameter read by the tm_cloudfront
 * extension (`TM_CLOUDFRONT_DISTRIBUTION_IDS`) and by the pipeline
 * invalidation step. The format depends on the tm_cloudfront version.
 */
export enum DistributionIdsFormat {
  /**
   * A single distribution ID.
   */
  PLAIN = 'PLAIN',
  /**
   * A JSON list of distribution IDs.
   */
  JSON_LIST = 'JSON_LIST',
  /**
   * A JSON object mapping each domain to its distribution ID.
   */
  JSON_MAP = 'JSON_MAP',
}

/**
 * IAM service users whose access keys are given to TYPO3.
 */
export enum ServiceIamUser {
  /**
   * `s3Service`: read and write access to the FAL content bucket.
   */
  S3 = 'S3',
  /**
   * `cloudfrontService`: CloudFront invalidations.
   */
  CLOUDFRONT = 'CLOUDFRONT',
}
