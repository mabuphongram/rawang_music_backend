const Minio = require("minio");
const path = require("path");
const fs = require("fs/promises");
const { randomUUID } = require("crypto");

function getMinioConfig() {
  const configuredEndpoint = process.env.MINIO_ENDPOINT;
  const configuredPort = process.env.MINIO_PORT;

  if (!configuredEndpoint || !process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY || !process.env.MINIO_BUCKET) {
    const error = new Error("MinIO environment variables are not fully configured");
    error.status = 500;
    throw error;
  }

  const endpointUrl = configuredEndpoint.includes("://")
    ? new URL(configuredEndpoint)
    : new URL(`http://${configuredEndpoint}`);
  const port = Number(configuredPort || endpointUrl.port || (endpointUrl.protocol === "https:" ? 443 : 80));

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    const error = new Error("MINIO_PORT must be a valid port number");
    error.status = 500;
    throw error;
  }

  const useSSL = process.env.MINIO_USE_SSL === "true";

  return {
    endpoint: endpointUrl.hostname,
    port,
    useSSL,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET,
  };
}

function createMinioClient(config) {
  return new Minio.Client({
    endPoint: config.endpoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });
}

/**
 * Upload a Multer disk-storage file to MinIO.
 *
 * @param {string} objectPath Folder/key prefix in the bucket, for example "singer".
 * @param {Express.Multer.File} file File supplied by Multer.
 * @returns {Promise<string>} The object key, for example "singer/<uuid>.jpg".
 */
async function minioUpload(objectPath, file) {
  if (!file?.path) {
    const error = new Error("A Multer disk-storage file is required for MinIO upload");
    error.status = 400;
    throw error;
  }

  const config = getMinioConfig();
  const client = createMinioClient(config);
  const prefix = String(objectPath || "").replace(/^\/+|\/+$/g, "");
  const originalExtension = path.extname(file.originalname || file.filename || "").toLowerCase();
  const objectName = [prefix, `${randomUUID()}${originalExtension}`].filter(Boolean).join("/");

  const bucketExists = await client.bucketExists(config.bucket);
  if (!bucketExists) await client.makeBucket(config.bucket, "us-east-1");

  await client.fPutObject(config.bucket, objectName, file.path, {
    "Content-Type": file.mimetype || "application/octet-stream",
  });

  // Multer saved this file only as a staging step before the MinIO upload.
  await fs.unlink(file.path).catch((error) => {
    console.warn(`Could not remove temporary upload ${file.path}: ${error.message}`);
  });

  return objectName;
}

module.exports = { minioUpload };
