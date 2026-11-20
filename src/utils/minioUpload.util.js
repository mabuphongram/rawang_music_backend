const Minio = require("minio");
const path = require("path");
const fs = require("fs/promises");
const { randomUUID } = require("crypto");

function getStorageConfig() {
  // Garage is S3-compatible. S3_* variables are preferred; the old MINIO_*
  // names remain as a fallback so existing deployments keep working.
  const configuredEndpoint = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY;
  const bucket = process.env.S3_BUCKET || process.env.MINIO_BUCKET;
  const configuredPort = process.env.S3_PORT || process.env.MINIO_PORT;

  if (!configuredEndpoint || !accessKey || !secretKey || !bucket) {
    const error = new Error("S3/Garage storage environment variables are not fully configured");
    error.status = 500;
    throw error;
  }

  const endpointUrl = configuredEndpoint.includes("://")
    ? new URL(configuredEndpoint)
    : new URL(`http://${configuredEndpoint}`);
  const port = Number(
    configuredPort || endpointUrl.port || (endpointUrl.protocol === "https:" ? 443 : 80)
  );

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    const error = new Error("S3 storage port must be a valid port number");
    error.status = 500;
    throw error;
  }

  const sslFlag = process.env.S3_USE_SSL || process.env.MINIO_USE_SSL;
  const useSSL = sslFlag === undefined
    ? endpointUrl.protocol === "https:"
    : sslFlag === "true";

  return {
    endpoint: endpointUrl.hostname,
    port,
    useSSL,
    region: process.env.S3_REGION || process.env.MINIO_REGION || "us-east-1",
    accessKey,
    secretKey,
    bucket,
  };
}

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

function resolveContentType(file, extension) {
  const mime = String(file.mimetype || "").toLowerCase();
  if (mime && mime !== "application/octet-stream") return mime;
  return MIME_BY_EXT[extension] || "application/octet-stream";
}

function createStorageClient(config) {
  return new Minio.Client({
    endPoint: config.endpoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    region: config.region,
    pathStyle: true,
  });
}

/**
 * Upload a Multer disk-storage file to S3/Garage-compatible storage.
 *
 * @param {string} objectPath Folder/key prefix in the bucket, for example "singer".
 * @param {Express.Multer.File} file File supplied by Multer.
 * @param {string} [fileName] Optional object file name without its extension.
 * @returns {Promise<string>} The object key, for example "singer/<uuid>.jpg".
 */
async function minioUpload(objectPath, file, fileName) {
  if (!file?.path) {
    const error = new Error("A Multer disk-storage file is required for S3 upload");
    error.status = 400;
    throw error;
  }

  const config = getStorageConfig();
  const client = createStorageClient(config);
  const prefix = String(objectPath || "").replace(/^\/+|\/+$/g, "");
  const originalExtension = path.extname(file.originalname || file.filename || "").toLowerCase();
  const name = fileName ? `${fileName}${originalExtension}` : `${randomUUID()}${originalExtension}`;
  const objectName = [prefix, name].filter(Boolean).join("/");

  const bucketExists = await client.bucketExists(config.bucket);
  if (!bucketExists) await client.makeBucket(config.bucket, config.region);

  await client.fPutObject(config.bucket, objectName, file.path, {
    "Content-Type": resolveContentType(file, originalExtension),
  });

  // Multer saved this file only as a staging step before the S3 upload.
  await fs.unlink(file.path).catch((error) => {
    console.warn(`Could not remove temporary upload ${file.path}: ${error.message}`);
  });

  return objectName;
}

/**
 * Move an object within the bucket (copy + delete).
 * Used to promote approved contributions: pending/<id>/... -> albums/<id>/tracks/...
 *
 * @param {string} srcKey Existing object key.
 * @param {string} destKey Destination object key.
 * @returns {Promise<string>} The destination key.
 */
async function minioMove(srcKey, destKey) {
  const config = getStorageConfig();
  const client = createStorageClient(config);
  await client.statObject(config.bucket, srcKey);
  await client.copyObject(config.bucket, destKey, `/${config.bucket}/${srcKey}`);
  await client.removeObject(config.bucket, srcKey);
  return destKey;
}

/**
 * Best-effort single object delete (used when discarding contributions).
 * Missing keys are ignored.
 */
async function minioRemoveObject(key) {
  if (!key) return;
  const config = getStorageConfig();
  const client = createStorageClient(config);
  try {
    await client.removeObject(config.bucket, key);
  } catch (error) {
    if (error.code !== "NoSuchKey" && error.code !== "NotFound") throw error;
  }
}

module.exports = {
  minioUpload,
  minioMove,
  minioRemoveObject,
  getStorageConfig,
};
