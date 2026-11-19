// Shared Cloudflare R2 helper using aws4fetch (ESM-safe, zero native deps)
import { AwsClient } from 'aws4fetch';

export function getCleanAccountId(): string {
  let id = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  id = id.replace(/^["']|["']$/g, '').trim();
  id = id.replace(/^https?:\/\//i, '');
  if (id.includes('.r2.cloudflarestorage.com')) {
    id = id.replace(/\.r2\.cloudflarestorage\.com.*$/i, '');
  }
  if (id.includes('dash.cloudflare.com/')) {
    const match = id.match(/dash\.cloudflare\.com\/([a-zA-Z0-9]+)/);
    if (match) id = match[1];
  }
  id = id.replace(/\/.*$/, '').trim();
  // Cloudflare Account ID is strictly 32-character hexadecimal
  id = id.replace(/[^a-zA-Z0-9]/g, '');
  return id;
}

export const BUCKET_NAME = (process.env.CLOUDFLARE_R2_BUCKET || 'christmas-tree-photos')
  .trim().replace(/^["']|["']$/g, '').replace(/^\/+|\/+$/g, '');

export function getR2BaseUrl(): string {
  const customEndpoint = (process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT || '').trim().replace(/^["']|["']$/g, '');
  if (customEndpoint) {
    try {
      const withProto = customEndpoint.startsWith('http') ? customEndpoint : `https://${customEndpoint}`;
      const parsed = new URL(withProto);
      return parsed.origin;
    } catch {
      return customEndpoint.replace(/\/+$/, '');
    }
  }
  const accountId = getCleanAccountId();
  if (!accountId) throw new Error('Chưa thiết lập CLOUDFLARE_ACCOUNT_ID trên Vercel.');
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

let cachedClient: AwsClient | null = null;

export function getR2Client(): AwsClient {
  if (cachedClient) return cachedClient;
  const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '').trim().replace(/^["']|["']$/g, '');
  const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!accessKeyId || !secretAccessKey) throw new Error('Chưa thiết lập CLOUDFLARE_R2_ACCESS_KEY_ID hoặc CLOUDFLARE_R2_SECRET_ACCESS_KEY trên Vercel.');
  cachedClient = new AwsClient({ accessKeyId, secretAccessKey, region: 'auto', service: 's3' });
  return cachedClient;
}
