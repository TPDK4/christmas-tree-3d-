import { AwsClient } from 'aws4fetch';

const DEFAULT_ACCOUNT_ID = '59aa662515a87635e7f868ccb1590294';
const DEFAULT_ACCESS_KEY_ID = 'f4c9eb72e1fe834ed82bf359037d5d5e';
const DEFAULT_SECRET_ACCESS_KEY = '23dce2ed7ed391ef11f7cf7b526efd00e03e0dbd7a1b8f53a7ba8409905cbdae';
const DEFAULT_BUCKET_NAME = 'christmas-tree-photos';
const KVDB_BUCKET_ID = '4pNmK8yZ3tWq7vR2uLxE5j';

function getCleanAccountId(): string {
  let id = (
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID_1 ||
    process.env.CF_ACCOUNT_ID ||
    process.env.ACCOUNT_ID ||
    DEFAULT_ACCOUNT_ID
  ).trim();
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
  id = id.replace(/[^a-zA-Z0-9]/g, '');
  return id || DEFAULT_ACCOUNT_ID;
}

const BUCKET_NAME = (
  process.env.CLOUDFLARE_R2_BUCKET ||
  process.env.R2_BUCKET ||
  DEFAULT_BUCKET_NAME
).trim().replace(/^["']|["']$/g, '').replace(/^\/+|\/+$/g, '') || DEFAULT_BUCKET_NAME;

function getR2BaseUrl(): string {
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
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function getR2Credentials() {
  const accessKeyId = (
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID_1 ||
    process.env.R2_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    DEFAULT_ACCESS_KEY_ID
  ).trim().replace(/^["']|["']$/g, '') || DEFAULT_ACCESS_KEY_ID;

  const secretAccessKey = (
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY_1 ||
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    DEFAULT_SECRET_ACCESS_KEY
  ).trim().replace(/^["']|["']$/g, '') || DEFAULT_SECRET_ACCESS_KEY;

  return { accessKeyId, secretAccessKey };
}

function getKVConfig() {
  const namespaceId = (process.env.CLOUDFLARE_KV_NAMESPACE_ID || process.env.KV_NAMESPACE_ID || '').trim().replace(/^["']|["']$/g, '');
  const apiToken = (process.env.CLOUDFLARE_KV_API_TOKEN || process.env.KV_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || '').trim().replace(/^["']|["']$/g, '');
  return { namespaceId, apiToken };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Share ID is required' });

    const cleanAccountId = getCleanAccountId();
    const { accessKeyId, secretAccessKey } = getR2Credentials();
    const { namespaceId: KV_NAMESPACE_ID, apiToken: KV_API_TOKEN } = getKVConfig();

    // Diagnostic endpoint to check configured cloud storage
    if (id === 'status' || id === '__health') {
      const mask = (s: string) => s ? `${s.slice(0, 4)}...${s.slice(-4)} (${s.length})` : 'EMPTY';
      let r2TestResult = 'Not attempted';
      if (accessKeyId && secretAccessKey && cleanAccountId) {
        try {
          const r2 = new AwsClient({ accessKeyId, secretAccessKey, region: 'auto', service: 's3' });
          const baseUrl = getR2BaseUrl();
          const testUrl = `${baseUrl}/${BUCKET_NAME}/__health.json`;
          const testResp = await r2.fetch(testUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ok', timestamp: Date.now() }),
          });
          r2TestResult = testResp.ok ? 'SUCCESS (HTTP 200)' : `FAILED (HTTP ${testResp.status})`;
        } catch (err: any) {
          r2TestResult = `ERROR: ${err.message}`;
        }
      }
      return res.status(200).json({
        status: 'ok',
        accountId: mask(cleanAccountId),
        accessKeyId: mask(accessKeyId),
        secretAccessKey: mask(secretAccessKey),
        rawSecretVar: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ? mask(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) : 'EMPTY',
        rawSecretVar1: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY_1 ? mask(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY_1) : 'EMPTY',
        bucket: BUCKET_NAME,
        r2TestResult,
      });
    }

    // 1. Primary: Fetch meta.json from R2 if R2 is configured
    if (accessKeyId && secretAccessKey && cleanAccountId) {
      try {
        const r2 = new AwsClient({ accessKeyId, secretAccessKey, region: 'auto', service: 's3' });
        const baseUrl = getR2BaseUrl();
        const metaUrl = `${baseUrl}/${BUCKET_NAME}/${id}/meta.json`;
        const r2Resp = await r2.fetch(metaUrl, { method: 'GET' });

        if (r2Resp.ok) {
          const shareData = await r2Resp.json();
          return res.status(200).json({
            success: true,
            images: shareData.images || [],
            music: shareData.music || null,
            mask: shareData.mask || 'none',
            createdAt: shareData.createdAt || Date.now(),
          });
        }
      } catch (r2Err: any) {
        console.warn(`R2 meta lookup failed for ${id}:`, r2Err?.message);
      }
    }

    // 2. Fallback: Cloudflare KV
    if (KV_NAMESPACE_ID && KV_API_TOKEN && cleanAccountId) {
      try {
        const kvResp = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${id}`,
          { headers: { 'Authorization': `Bearer ${KV_API_TOKEN}` } }
        );
        if (kvResp.ok) {
          const kvData = await kvResp.json();
          return res.status(200).json({
            success: true,
            images: kvData.images || [],
            music: kvData.music || null,
            mask: kvData.mask || 'none',
            createdAt: kvData.createdAt || Date.now(),
          });
        }
      } catch (kvErr: any) {
        console.warn('KV fallback failed:', kvErr?.message);
      }
    }

    // 3. Fallback: Public KVDB store
    try {
      const kvdbResp = await fetch(`https://kvdb.io/${KVDB_BUCKET_ID}/${id}`);
      if (kvdbResp.ok) {
        const kvdbData = await kvdbResp.json();
        return res.status(200).json({
          success: true,
          images: kvdbData.images || [],
          music: kvdbData.music || null,
          mask: kvdbData.mask || 'none',
          createdAt: kvdbData.createdAt || Date.now(),
        });
      }
    } catch (kvdbErr: any) {
      console.warn('KVDB lookup failed:', kvdbErr?.message);
    }

    return res.status(404).json({ error: 'Share not found or expired' });
  } catch (error: any) {
    console.error('Share retrieval error:', error);
    return res.status(500).json({ error: 'Failed to retrieve share', message: error.message });
  }
}
