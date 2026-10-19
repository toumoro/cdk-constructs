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
   * A content bucket, read by TYPO3 through the extension selected by
   * `FalSettings.s3Driver` (the `TM_S3ASSETS_*` variables by default).
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

/**
 * Where `TmPipelineStack` reads its infrastructure and application source from.
 *
 * A string-literal union (`'codecommit' | 's3'`) cannot be used here: jsii does
 * not support TypeScript literal unions in the public API, so the selector is
 * an enum.
 */
export enum PipelineSourceType {
  /**
   * CodeCommit repositories, polled through CodeStar connections. The library's
   * original and default behaviour.
   */
  CODECOMMIT = 'CODECOMMIT',
  /**
   * Versioned S3 buckets fed by GitHub Actions over OIDC, each change detected
   * by an EventBridge rule. No CodeCommit mirror needed.
   */
  S3 = 'S3',
}

/**
 * TYPO3 extension reading the FAL content bucket. Selects the variable names
 * the stage passes to the containers.
 */
export enum FalS3Driver {
  /**
   * tm_s3assets (deprecated): `TM_S3ASSETS_BUCKET_NAME`, `TM_S3ASSETS_REGION`,
   * `TM_S3ASSETS_DOMAIN` (the CDN domain), and with the S3 service user
   * `TM_S3ASSETS_ACCESS_KEY_ID` / `TM_S3ASSETS_SECRET_KEY`.
   */
  TM_S3ASSETS = 'tm_s3assets',

  /**
   * aus_driver_amazon_s3: `TM_AUS_DRIVER_AMAZON_S3_BUCKET`,
   * `TM_AUS_DRIVER_AMAZON_S3_REGION`, `TM_AUS_DRIVER_AMAZON_S3_PUBLIC_BASE_URL`
   * (the CDN domain, without protocol), and with the S3 service user
   * `TM_AUS_DRIVER_AMAZON_S3_KEY` / `TM_AUS_DRIVER_AMAZON_S3_SECRET`. Without
   * the service user the key variables are not set and the driver falls back
   * to the AWS SDK default credential chain, i.e. the ECS task role, which the
   * stage then grants read/write on the content bucket.
   */
  AUS_DRIVER_AMAZON_S3 = 'aus_driver_amazon_s3',
}
