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

  const { key } = req.query;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Key query parameter is required' });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    if (!response.Body) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Stream or buffer response
    const stream = response.Body as any;
    if (typeof stream.pipe === 'function') {
      return stream.pipe(res);
    } else {
      const byteArray = await response.Body.transformToByteArray();
      return res.status(200).send(Buffer.from(byteArray));
    }
  } catch (error: any) {
    console.error('Photo retrieval error:', error);
    return res.status(404).json({ 
      error: 'Photo not found', 
      message: error.message 
    });
  }
}
