import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Cloudflare R2 configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET || 'christmas-tree-photos';

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

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    if (!response.Body) {
      return res.status(404).json({ error: 'Photo not found' });
    }

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
  } catch (error: any) {
    console.error(`Photo retrieval error for key "${key}":`, error?.message);
    return res.status(404).json({ 
      error: 'Photo not found', 
      message: error.message 
    });
  }
}
