import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';

// Cloudflare R2 configuration
// NOTE: forcePathStyle: true is strictly REQUIRED for Cloudflare R2!
// Without forcePathStyle: true, the AWS SDK creates subdomains like
// https://bucket.account_id.r2.cloudflarestorage.com, which violates
// Cloudflare's wildcard certificate (*.r2.cloudflarestorage.com)
// and causes net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH in browsers.
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
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').trim();

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
    const { imageCount } = req.body;

    if (!imageCount || imageCount < 1 || imageCount > 22) {
      return res.status(400).json({ error: 'Invalid image count (1-22)' });
    }

    // Generate unique share ID
    const shareId = nanoid(8);
    const uploadUrls: Array<{ uploadUrl: string; publicUrl: string; key: string }> = [];

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = req.headers.origin || (host ? `${proto}://${host}` : '');

    // Normalize public URL base
    let publicBase = R2_PUBLIC_URL.replace(/\/+$/, '');
    if (publicBase && !publicBase.startsWith('http://') && !publicBase.startsWith('https://')) {
      publicBase = `https://${publicBase}`;
    }

    // Generate presigned URLs for each image
    for (let i = 0; i < imageCount; i++) {
      const filename = `${shareId}/${i}.jpg`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filename,
        ContentType: 'image/jpeg',
      });

      // Generate presigned URL valid for 10 minutes
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });
      
      // If R2_PUBLIC_URL is not set, use /api/photo proxy to seamlessly serve photos
      const publicUrl = publicBase
        ? `${publicBase}/${filename}`
        : `${origin}/api/photo?key=${encodeURIComponent(filename)}`;

      uploadUrls.push({
        uploadUrl,
        publicUrl,
        key: filename,
      });
    }

    return res.status(200).json({
      success: true,
      shareId,
      uploadUrls,
    });
  } catch (error: any) {
    console.error('Generate upload URLs error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate upload URLs', 
      message: error.message 
    });
  }
}
