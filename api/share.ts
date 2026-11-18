import { getR2Client, getR2BaseUrl, BUCKET_NAME, getCleanAccountId } from './_r2';

const KV_NAMESPACE_ID = (process.env.CLOUDFLARE_KV_NAMESPACE_ID || '').trim().replace(/^["']|["']$/g, '');
const KV_API_TOKEN = (process.env.CLOUDFLARE_KV_API_TOKEN || '').trim().replace(/^["']|["']$/g, '');

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

    // 1. Primary: Fetch meta.json from R2
    try {
      const r2 = getR2Client();
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

    return res.status(404).json({ error: 'Share not found or expired' });
  } catch (error: any) {
    console.error('Share retrieval error:', error);
    return res.status(500).json({ error: 'Failed to retrieve share', message: error.message });
  }
}
