const KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
const KV_API_TOKEN = process.env.CLOUDFLARE_KV_API_TOKEN || '';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';

// Helper function to store data in Cloudflare KV
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
    throw new Error(`Failed to store in KV: ${response.statusText}`);
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
    const { shareId, imageUrls, music, mask } = req.body;

    if (!shareId || !imageUrls || !Array.isArray(imageUrls)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // Store share data in KV with 30-day expiration
    await storeInKV(shareId, imageUrls, music, mask);

    // Return share link
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
    const shareLink = `${origin}/?share=${shareId}`;

    return res.status(200).json({
      success: true,
      shareId,
      shareLink,
      imageCount: imageUrls.length,
    });
  } catch (error: any) {
    console.error('Complete upload error:', error);
    return res.status(500).json({ 
      error: 'Failed to complete upload', 
      message: error.message 
    });
  }
}

