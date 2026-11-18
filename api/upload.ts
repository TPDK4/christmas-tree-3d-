import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, BUCKET_NAME, getCleanAccountId } from './_r2';

const KV_NAMESPACE_ID = (process.env.CLOUDFLARE_KV_NAMESPACE_ID || '').trim().replace(/^["']|["']$/g, '');
const KV_API_TOKEN = (process.env.CLOUDFLARE_KV_API_TOKEN || '').trim().replace(/^["']|["']$/g, '');
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').trim().replace(/^["']|["']$/g, '');

function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Helper function to convert base64 data to Buffer
async function parseBase64Image(base64Data: string): Promise<Buffer> {
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Image, 'base64');
}

// Helper function to store data in Cloudflare KV
async function storeInKV(shareId: string, imageUrls: string[], cleanAccountId: string, music?: any, mask?: string): Promise<void> {
  const data = {
    images: imageUrls,
    music: music || null,
    mask: mask || 'none',
    createdAt: Date.now(),
  };

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${shareId}?expiration_ttl=2592000`,
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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON request body' });
      }
    }

    const { images, music, mask } = body || {};

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    if (images.length > 22) {
      return res.status(400).json({ error: 'Maximum 22 images allowed' });
    }

    // Generate unique share ID
    const shareId = generateShareId();
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = req.headers.origin || (host ? `${proto}://${host}` : '');

    let publicBase = R2_PUBLIC_URL.replace(/\/+$/, '');
    if (publicBase && !publicBase.startsWith('http://') && !publicBase.startsWith('https://')) {
      publicBase = `https://${publicBase}`;
    }

    const cleanAccountId = getCleanAccountId();
    let r2Success = false;

    // Attempt 1: Upload to Cloudflare R2
    try {
      const s3Client = getS3Client();

      // Parallel upload of all images to R2
      const uploadPromises = images.map(async (imageData, i) => {
        const imageBuffer = await parseBase64Image(imageData);
        const filename = `${shareId}/${i}.jpg`;

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: filename,
          Body: imageBuffer,
          ContentType: 'image/jpeg',
        });

        await s3Client.send(command);

        return publicBase
          ? `${publicBase}/${filename}`
          : `${origin}/api/photo?key=${filename}`;
      });

      const imageUrls = await Promise.all(uploadPromises);

      // Store metadata JSON in R2
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
      r2Success = true;

      // Optional KV backup
      if (KV_NAMESPACE_ID && KV_API_TOKEN && cleanAccountId) {
        try {
          await storeInKV(shareId, imageUrls, cleanAccountId, music, mask);
        } catch (kvErr) {
          console.warn('Optional KV backup failed:', kvErr);
        }
      }
    } catch (r2Error: any) {
      console.warn('R2 storage attempt failed:', r2Error?.message || r2Error);

      // Attempt 2: Fallback directly to Cloudflare KV if configured
      if (KV_NAMESPACE_ID && KV_API_TOKEN && cleanAccountId) {
        try {
          console.info('Attempting fallback to Cloudflare KV...');
          await storeInKV(shareId, images, cleanAccountId, music, mask);
          r2Success = true;
        } catch (kvError: any) {
          console.error('KV fallback also failed:', kvError);
          throw r2Error;
        }
      } else {
        throw r2Error;
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
      imageCount: images.length,
    });
  } catch (error: any) {
    console.error('Upload error:', error);

    let friendlyMessage = error?.message || 'Có lỗi xảy ra khi tải ảnh lên.';
    if (
      friendlyMessage.includes('EPROTO') ||
      friendlyMessage.includes('alert number 40') ||
      friendlyMessage.includes('handshake failure') ||
      friendlyMessage.includes('ERR_SSL')
    ) {
      friendlyMessage = 'Lỗi SSL Handshake Cloudflare R2 (Alert 40): Vui lòng kiểm tra biến CLOUDFLARE_ACCOUNT_ID trên Vercel. Bạn chỉ cần điền mã Account ID (32 ký tự hex, ví dụ: 7a8b9c...), không điền cả đường dẫn https:// hay .r2.cloudflarestorage.com.';
    }

    return res.status(500).json({ 
      error: 'Failed to upload images', 
      message: friendlyMessage 
    });
  }
}
