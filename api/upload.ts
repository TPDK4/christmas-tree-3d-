import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';

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
const KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
const KV_API_TOKEN = process.env.CLOUDFLARE_KV_API_TOKEN || '';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').trim();

// Helper function to convert base64 data to Buffer
async function parseBase64Image(base64Data: string): Promise<Buffer> {
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Image, 'base64');
}

// Optional helper function to store data in Cloudflare KV as backup
async function storeInKV(shareId: string, imageUrls: string[], music?: any, mask?: string): Promise<void> {
  const data = {
    images: imageUrls,
    music: music || null,
    mask: mask || 'none',
    createdAt: Date.now(),
  };

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${shareId}?expiration_ttl=2592000`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${KV_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to store in KV: ${response.statusText} ${errorText}`);
  }
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { images, music, mask } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    if (images.length > 22) {
      return res.status(400).json({ error: 'Maximum 22 images allowed' });
    }

    // Generate unique share ID
    const shareId = nanoid(8);
    const imageUrls: string[] = [];

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = req.headers.origin || (host ? `${proto}://${host}` : '');

    let publicBase = R2_PUBLIC_URL.replace(/\/+$/, '');
    if (publicBase && !publicBase.startsWith('http://') && !publicBase.startsWith('https://')) {
      publicBase = `https://${publicBase}`;
    }

    // 1. Upload all photos to R2
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      const imageBuffer = await parseBase64Image(imageData);

      // Unique filename for this photo
      const filename = `${shareId}/${i}.jpg`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filename,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
      });

      await s3Client.send(command);

      const imageUrl = publicBase
        ? `${publicBase}/${filename}`
        : `${origin}/api/photo?key=${filename}`;

      imageUrls.push(imageUrl);
    }

    // 2. Store metadata JSON directly in R2 (Primary storage - zero extra dependencies)
    const shareMetadata = {
      images: imageUrls,
      music: music || null,
      mask: mask || 'none',
      createdAt: Date.now(),
    };

    const metaCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${shareId}/meta.json`,
      Body: Buffer.from(JSON.stringify(shareMetadata)),
      ContentType: 'application/json',
    });

    await s3Client.send(metaCommand);

    // 3. Optional: Store in KV as backup if KV environment variables are present
    if (KV_NAMESPACE_ID && KV_API_TOKEN && CLOUDFLARE_ACCOUNT_ID) {
      try {
        await storeInKV(shareId, imageUrls, music, mask);
      } catch (kvErr) {
        console.warn('Optional KV storage failed:', kvErr);
      }
    }

    // Return share link
    let shareLink = `${origin}/?share=${shareId}`;
    if (mask && mask !== 'none') shareLink += `&mask=${encodeURIComponent(mask)}`;
    if (music && music.url) shareLink += `&music=${encodeURIComponent(music.url)}`;

    return res.status(200).json({
      success: true,
      shareId,
      shareLink,
      imageCount: imageUrls.length,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Failed to upload images', 
      message: error.message 
    });
  }
}
