import { S3Client } from '@aws-sdk/client-s3';

/**
 * Extracts and sanitizes the Cloudflare Account ID from environment variables.
 * Handles:
 * - Pure 32-character hex account IDs: 'a1b2c3d4...'
 * - Full S3 URLs: 'https://a1b2c3d4...r2.cloudflarestorage.com'
 * - Domain strings: 'a1b2c3d4...r2.cloudflarestorage.com'
 * - Quoted strings: '"a1b2c3d4..."'
 * - Extra spaces, tabs, slashes, or prefixes
 */
export function getCleanAccountId(): string {
  let id = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  
  // Remove wrapping single or double quotes
  id = id.replace(/^["']|["']$/g, '').trim();

  // If user pasted the full S3 endpoint URL or domain
  if (id.includes('.r2.cloudflarestorage.com')) {
    id = id.replace(/^https?:\/\//i, '').replace(/\.r2\.cloudflarestorage\.com.*$/i, '');
  }

  // Strip any remaining protocol or path segments (e.g. https:// or /bucket-name)
  id = id.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();

  return id;
}

export const BUCKET_NAME = (process.env.CLOUDFLARE_R2_BUCKET || 'christmas-tree-photos')
  .trim()
  .replace(/^["']|["']$/g, '');

/**
 * Resolves the S3 endpoint for Cloudflare R2.
 * Supports explicit CLOUDFLARE_R2_ENDPOINT or auto-generates from sanitized account ID.
 */
export function getR2Endpoint(): string {
  const customEndpoint = (process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT || '').trim().replace(/^["']|["']$/g, '');
  if (customEndpoint) {
    let ep = customEndpoint.replace(/\/+$/, '');
    if (!ep.startsWith('http://') && !ep.startsWith('https://')) {
      ep = `https://${ep}`;
    }
    return ep;
  }

  const accountId = getCleanAccountId();
  if (!accountId) {
    throw new Error('Chưa thiết lập biến CLOUDFLARE_ACCOUNT_ID trên Vercel. Vui lòng kiểm tra mục Environment Variables.');
  }

  return `https://${accountId}.r2.cloudflarestorage.com`;
}

let cachedS3Client: S3Client | null = null;

/**
 * Creates and returns a configured AWS S3Client targeting Cloudflare R2.
 * Throws friendly actionable errors if environment variables are missing.
 */
export function getS3Client(): S3Client {
  if (cachedS3Client) {
    return cachedS3Client;
  }

  const endpoint = getR2Endpoint();

  const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Chưa thiết lập CLOUDFLARE_R2_ACCESS_KEY_ID hoặc CLOUDFLARE_R2_SECRET_ACCESS_KEY trên Vercel.');
  }

  cachedS3Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true, // Strictly required for Cloudflare R2 wildcard SSL
  });

  return cachedS3Client;
}
