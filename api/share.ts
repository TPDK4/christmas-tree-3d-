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
const KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
const KV_API_TOKEN = process.env.CLOUDFLARE_KV_API_TOKEN || '';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';

// Helper function to retrieve data from Cloudflare KV as fallback
async function getFromKV(shareId: string): Promise<{ images: string[]; music?: any; mask?: string; createdAt: number } | null> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${shareId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${KV_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to retrieve from KV: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('KV retrieval warning:', error);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Share ID is required' });
    }

    // 1. Primary check: Retrieve metadata JSON directly from R2
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${id}/meta.json`,
      });

      const response = await s3Client.send(command);
      if (response.Body) {
        const bodyBytes = await response.Body.transformToByteArray();
        const jsonStr = Buffer.from(bodyBytes).toString('utf-8');
        const shareData = JSON.parse(jsonStr);

        return res.status(200).json({
          success: true,
          images: shareData.images || [],
          music: shareData.music || null,
          mask: shareData.mask || 'none',
          createdAt: shareData.createdAt || Date.now(),
        });
      }
    } catch (r2Err: any) {
      console.warn(`R2 metadata lookup failed for ${id}, trying KV:`, r2Err?.message);
    }

    // 2. Secondary check: Cloudflare KV fallback
    if (KV_NAMESPACE_ID && KV_API_TOKEN && CLOUDFLARE_ACCOUNT_ID) {
      const kvData = await getFromKV(id);
      if (kvData) {
        return res.status(200).json({
          success: true,
          images: kvData.images || [],
          music: kvData.music || null,
          mask: kvData.mask || 'none',
          createdAt: kvData.createdAt,
        });
      }
    }

    return res.status(404).json({ error: 'Share not found or expired' });
  } catch (error: any) {
    console.error('Share retrieval error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve share', 
      message: error.message 
    });
  }
}
