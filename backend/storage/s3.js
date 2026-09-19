const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

let s3ClientInstance = null;

function getS3Config() {
  const bucketName = process.env.S3_BUCKET_NAME || process.env.CV_BUCKET || 'cvs';
  const region = process.env.AWS_REGION || process.env.COGNITO_REGION || 'us-east-1';
  return { bucketName, region };
}

function getS3Client() {
  if (!s3ClientInstance) {
    const { region } = getS3Config();
    const config = { region };

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    s3ClientInstance = new S3Client(config);
  }
  return s3ClientInstance;
}

/**
 * Sanitize and normalize S3 object keys to prevent path traversal attacks.
 * Removes leading slashes and prevents '..' traversal segments.
 */
function sanitizeKey(key) {
  if (typeof key !== 'string' || !key.trim()) {
    throw new Error('Invalid S3 object key');
  }

  // Normalize slashes and remove leading slashes
  let cleanKey = key.replace(/\\/g, '/').replace(/^\/+/, '');

  // Prevent path traversal attempts
  const parts = cleanKey.split('/').filter(Boolean);
  const safeParts = [];

  for (const part of parts) {
    if (part === '..') {
      throw new Error('Path traversal sequence (..) is not allowed in object keys');
    }
    if (part !== '.') {
      safeParts.push(part);
    }
  }

  if (safeParts.length === 0) {
    throw new Error('Empty or invalid object key after sanitization');
  }

  return safeParts.join('/');
}

function getBucketName() {
  const { bucketName } = getS3Config();
  return bucketName;
}

/**
 * Upload an object buffer to Amazon S3.
 *
 * @param {string} key - S3 object key (e.g., 'uploads/uuid.pdf')
 * @param {Buffer} buffer - Binary file buffer
 * @param {string} contentType - MIME type (e.g., 'application/pdf')
 * @returns {Promise<{ key: string, bucket: string }>}
 */
async function uploadObject(key, buffer, contentType) {
  const client = getS3Client();
  const bucket = getBucketName();
  const safeKey = sanitizeKey(key);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: safeKey,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  });

  await client.send(command);
  return { key: safeKey, bucket };
}

/**
 * Generate a presigned download URL for an S3 object.
 *
 * @param {string} key - S3 object key
 * @param {number} expiresInSeconds - URL expiration in seconds (default: 3600)
 * @returns {Promise<string>} - Presigned URL
 */
async function createPresignedDownloadUrl(key, expiresInSeconds = 3600) {
  const client = getS3Client();
  const bucket = getBucketName();
  const safeKey = sanitizeKey(key);

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: safeKey,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete an object from S3.
 *
 * @param {string} key - S3 object key
 */
async function deleteObject(key) {
  const client = getS3Client();
  const bucket = getBucketName();
  const safeKey = sanitizeKey(key);

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: safeKey,
  });

  await client.send(command);
}

module.exports = {
  getS3Client,
  getBucketName,
  sanitizeKey,
  uploadObject,
  createPresignedDownloadUrl,
  deleteObject,
};
