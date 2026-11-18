import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, BUCKET_NAME, getCleanAccountId } from './_r2';

const KV_NAMESPACE_ID = (process.env.CLOUDFLARE_KV_NAMESPACE_ID || '').trim().replace(/^["']|["']$/g, '');
const KV_API_TOKEN = (process.env.CLOUDFLARE_KV_API_TOKEN || '').trim().replace(/^["']|["']$/g, '');

// Helper to check Cloudflare KV fallback
async function getPhotoFromKV(shareId: string, index: number, cleanAccountId: string): Promise<Buffer | null> {
  if (!KV_NAMESPACE_ID || !KV_API_TOKEN || !cleanAccountId) return null;
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${shareId}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${KV_API_TOKEN}` },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.images && data.images[index]) {
      const imgData = data.images[index];
      if (imgData.startsWith('data:image/')) {
        const base64Data = imgData.replace(/^data:image\/\w+;base64,/, '');
        return Buffer.from(base64Data, 'base64');
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let rawKey = (req.query.key as string) || '';
  if (!rawKey) {
    return res.status(400).json({ error: 'Key query parameter is required' });
  }

  // Handle URL decoding (e.g. if key was passed as shareId%2F0.jpg or full URL)
  let key = rawKey;
  if (key.startsWith('http://') || key.startsWith('https://')) {
    try {
      const urlObj = new URL(key);
      key = urlObj.pathname;
    } catch (e) {}
  }

  try {
    key = decodeURIComponent(key);
  } catch (e) {}

  // Strip leading slashes and any api/photo prefixes
  key = key.replace(/^\/+/, '');
  if (key.includes('api/photo')) {
    const match = key.match(/key=([^&]+)/);
    if (match) {
      try {
        key = decodeURIComponent(match[1]);
      } catch (e) {
        key = match[1];
      }
    } else {
      key = key.replace(/^.*api\/photo\/?/, '');
    }
  }
  key = key.replace(/^\/+/, '');

  // 1. Try fetching from Cloudflare R2
  try {
    const s3Client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    if (response.Body) {
      const byteArray = await response.Body.transformToByteArray();
      const buffer = Buffer.from(byteArray);

      res.writeHead(200, {
        'Content-Type': response.ContentType || 'image/jpeg',
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      });
      return res.end(buffer);
    }
  } catch (r2Error: any) {
    console.warn(`R2 photo fetch failed for key "${key}":`, r2Error?.message);
  }

  // 2. Fallback: Try fetching from Cloudflare KV
  const keyParts = key.match(/^([a-zA-Z0-9_-]+)\/(\d+)\.jpg$/);
  if (keyParts) {
    const shareId = keyParts[1];
    const photoIdx = parseInt(keyParts[2], 10);
    const cleanAccountId = getCleanAccountId();
    const kvBuffer = await getPhotoFromKV(shareId, photoIdx, cleanAccountId);
    if (kvBuffer) {
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': kvBuffer.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      });
      return res.end(kvBuffer);
    }
  }

  return res.status(404).json({ 
    error: 'Photo not found', 
    key 
  });
}
