import { AwsClient } from 'aws4fetch';

function getCleanAccountId(): string {
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
  id = id.replace(/[^a-zA-Z0-9]/g, '');
  return id;
}

const BUCKET_NAME = (process.env.CLOUDFLARE_R2_BUCKET || 'christmas-tree-photos')
  .trim().replace(/^["']|["']$/g, '').replace(/^\/+|\/+$/g, '');

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
  if (!accountId) throw new Error('Chưa thiết lập CLOUDFLARE_ACCOUNT_ID trên Vercel.');
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function getR2Client(): AwsClient {
  const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '').trim().replace(/^["']|["']$/g, '');
  const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!accessKeyId || !secretAccessKey) throw new Error('Chưa thiết lập CLOUDFLARE_R2_ACCESS_KEY_ID hoặc CLOUDFLARE_R2_SECRET_ACCESS_KEY trên Vercel.');
  return new AwsClient({ accessKeyId, secretAccessKey, region: 'auto', service: 's3' });
}

const KV_NAMESPACE_ID = (process.env.CLOUDFLARE_KV_NAMESPACE_ID || '').trim().replace(/^["']|["']$/g, '');
const KV_API_TOKEN = (process.env.CLOUDFLARE_KV_API_TOKEN || '').trim().replace(/^["']|["']$/g, '');

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let rawKey = (req.query.key as string) || '';
  if (!rawKey) return res.status(400).json({ error: 'Key parameter is required' });

  // Normalize key
  let key = rawKey;
  if (key.startsWith('http://') || key.startsWith('https://')) {
    try { key = new URL(key).pathname; } catch {}
  }
  try { key = decodeURIComponent(key); } catch {}
  key = key.replace(/^\/+/, '');
  if (key.includes('api/photo')) {
    const match = key.match(/key=([^&]+)/);
    key = match ? decodeURIComponent(match[1]) : key.replace(/^.*api\/photo\/?/, '');
  }
  key = key.replace(/^\/+/, '');

  // Fetch from R2
  try {
    const r2 = getR2Client();
    const baseUrl = getR2BaseUrl();
    const url = `${baseUrl}/${BUCKET_NAME}/${key}`;
    const r2Resp = await r2.fetch(url, { method: 'GET' });

    if (r2Resp.ok) {
      const buffer = Buffer.from(await r2Resp.arrayBuffer());
      const contentType = r2Resp.headers.get('Content-Type') || 'image/jpeg';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end(buffer);
    } else {
      console.warn(`R2 photo fetch returned HTTP ${r2Resp.status} for key "${key}"`);
    }
  } catch (r2Err: any) {
    console.warn(`R2 photo fetch failed for key "${key}":`, r2Err?.message);
  }

  // KV fallback
  const keyParts = key.match(/^([a-zA-Z0-9_-]+)\/(\d+)\.jpg$/);
  if (keyParts && KV_NAMESPACE_ID && KV_API_TOKEN) {
    const shareId = keyParts[1];
    const photoIdx = parseInt(keyParts[2], 10);
    const cleanAccountId = getCleanAccountId();
    if (cleanAccountId) {
      try {
        const kvResp = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${shareId}`,
          { headers: { 'Authorization': `Bearer ${KV_API_TOKEN}` } }
        );
        if (kvResp.ok) {
          const data = await kvResp.json();
          const imgData: string = data?.images?.[photoIdx];
          if (imgData && imgData.startsWith('data:image/')) {
            const base64 = imgData.replace(/^data:image\/[^;]+;base64,/, '');
            const buffer = Buffer.from(base64, 'base64');
            res.writeHead(200, {
              'Content-Type': 'image/jpeg',
              'Content-Length': buffer.length,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Access-Control-Allow-Origin': '*',
            });
            return res.end(buffer);
          }
        }
      } catch (kvErr) { console.warn('KV photo fallback failed:', kvErr); }
    }
  }

  return res.status(404).json({ error: 'Photo not found', key });
}
