import { getR2Client, getR2BaseUrl, BUCKET_NAME, getCleanAccountId } from './_r2';

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
      });
      return res.end(buffer);
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
            const base64 = imgData.replace(/^data:image\/\w+;base64,/, '');
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
