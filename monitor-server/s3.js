// monitor-server/s3.js
// Raw telemetry log archival supporting Amazon S3 with local fallback

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

let s3Client = null;
let s3BucketName = null;
const localArchiveDir = path.join(__dirname, 'data', 's3-archive');

function initS3() {
  const useMock = process.env.USE_MOCK_AWS === 'true';
  s3BucketName = process.env.AWS_S3_BUCKET;

  if (!useMock && s3BucketName && process.env.AWS_REGION) {
    try {
      s3Client = new S3Client({ region: process.env.AWS_REGION });
      console.log(`🗄️ [S3] Connected to Amazon S3 bucket: ${s3BucketName}`);
      return;
    } catch (err) {
      console.warn(`[S3] Failed to initialize S3 Client: ${err.message}. Using local archival.`);
    }
  }

  // Ensure local archive directory exists for mock mode
  if (!fs.existsSync(localArchiveDir)) {
    fs.mkdirSync(localArchiveDir, { recursive: true });
  }
  console.log('🗄️ [S3] Operating in Mock / Local Archival mode (Local development).');
}

/**
 * Archive a batch of telemetry logs to S3
 */
async function archiveBatch(logs) {
  if (!logs || logs.length === 0) return { success: true, count: 0 };

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const filename = `logs-${Date.now()}.json`;
  const s3Key = `raw-logs/${dateStr}/${filename}`;
  const content = JSON.stringify(logs, null, 2);

  if (s3Client && s3BucketName) {
    try {
      const command = new PutObjectCommand({
        Bucket: s3BucketName,
        Key: s3Key,
        Body: content,
        ContentType: 'application/json'
      });
      await s3Client.send(command);
      return { success: true, s3Key, count: logs.length };
    } catch (err) {
      console.warn(`[S3] S3 PutObject failed: ${err.message}. Saving locally.`);
    }
  }

  // Local file fallback
  const localFilePath = path.join(localArchiveDir, `${dateStr}-${filename}`);
  fs.writeFileSync(localFilePath, content, 'utf8');

  return { success: true, localFile: localFilePath, count: logs.length };
}

module.exports = {
  initS3,
  archiveBatch,
  localArchiveDir
};
