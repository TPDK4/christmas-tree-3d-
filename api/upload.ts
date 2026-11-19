import { AwsClient } from 'aws4fetch';

function getCleanAccountId(): string {
  let id = (
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID_1 ||
    process.env.CF_ACCOUNT_ID ||
    process.env.ACCOUNT_ID ||
    ''
  ).trim();
  id = id.replace(/^["']|["']$/g, '').trim();
  id = id.replace(/^https?:\/\//i, '');
  if (id.includes('.r2.cloudflarestorage.com')) {
    id = id.replace(/\.r2\.cloudflarestorage\.com.*$/i, '');
  }
  if (id.includes('dash.cloudflare.com/')) {
    const match = id.match(/dash\.cloudflare\.com\/([a-zA-Z0-9]+)/);
    if (match) id = match[1];
  }
  id = id.replace(/\/.*$/, '').trim();
  id = id.replace(/[^a-zA-Z0-9]/g, '');
  return id;
}

const BUCKET_NAME = (process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET || 'christmas-tree-photos')
  .trim().replace(/^["']|["']$/g, '').replace(/^\/+|\/+$/g, '');

function getR2BaseUrl(): string {
  const customEndpoint = (process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT || '').trim().replace(/^["']|["']$/g, '');
  if (customEndpoint) {
    try {
      const withProto = customEndpoint.startsWith('http') ? customEndpoint : `https://${customEndpoint}`;
      const parsed = new URL(withProto);
      return parsed.origin;
    } catch {
      return customEndpoint.replace(/\/+$/, '');
    }
  }
  const accountId = getCleanAccountId();
  if (!accountId) throw new Error('Chưa thiết lập CLOUDFLARE_ACCOUNT_ID trên Vercel.');
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function getR2Credentials() {
  const accessKeyId = (
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID_1 ||
    process.env.R2_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  const secretAccessKey = (
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY_1 ||
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  return { accessKeyId, secretAccessKey };
}

function getKVConfig() {
  const namespaceId = (process.env.CLOUDFLARE_KV_NAMESPACE_ID || process.env.KV_NAMESPACE_ID || '').trim().replace(/^["']|["']$/g, '');
  const apiToken = (process.env.CLOUDFLARE_KV_API_TOKEN || process.env.KV_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || '').trim().replace(/^["']|["']$/g, '');
  return { namespaceId, apiToken };
}

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').trim().replace(/^["']|["']$/g, '');

function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function parseBase64Image(base64Data: string): Buffer {
  const base64 = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

async function storeInKV(shareId: string, payload: object, cleanAccountId: string, namespaceId: string, apiToken: string): Promise<void> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/storage/kv/namespaces/${namespaceId}/values/${shareId}?expiration_ttl=2592000`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`KV store failed: ${response.statusText} ${errText}`);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }

    const { images, music, mask } = body || {};
    if (!images || !Array.isArray(images) || images.length === 0) return res.status(400).json({ error: 'No images provided' });
    if (images.length > 22) return res.status(400).json({ error: 'Maximum 22 images allowed' });

    const shareId = generateShareId();
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = req.headers.origin || (host ? `${proto}://${host}` : '');

    let publicBase = R2_PUBLIC_URL.replace(/\/+$/, '');
    if (publicBase && !publicBase.startsWith('http')) publicBase = `https://${publicBase}`;

    const cleanAccountId = getCleanAccountId();
    const { accessKeyId, secretAccessKey } = getR2Credentials();
    const { namespaceId: KV_NAMESPACE_ID, apiToken: KV_API_TOKEN } = getKVConfig();

    const hasR2 = Boolean(accessKeyId && secretAccessKey && cleanAccountId);
    const hasKV = Boolean(KV_NAMESPACE_ID && KV_API_TOKEN && cleanAccountId);

    if (!hasR2 && !hasKV) {
      if (!cleanAccountId) {
        throw new Error('Chưa thiết lập CLOUDFLARE_ACCOUNT_ID trên Vercel.');
      }
      throw new Error('Chưa thiết lập R2 credentials (CLOUDFLARE_R2_ACCESS_KEY_ID) hoặc KV credentials trên Vercel.');
    }

    let uploadSuccess = false;

    // Strategy 1: Upload to Cloudflare R2 if configured
    if (hasR2) {
      try {
        const r2 = new AwsClient({ accessKeyId, secretAccessKey, region: 'auto', service: 's3' });
        const baseUrl = getR2BaseUrl();

        const imageUrls: string[] = await Promise.all(
          images.map(async (imageData: string, i: number) => {
            const bytes = parseBase64Image(imageData);
            const filename = `${shareId}/${i}.jpg`;
            const url = `${baseUrl}/${BUCKET_NAME}/${filename}`;

            const uploadResp = await r2.fetch(url, {
              method: 'PUT',
              headers: { 'Content-Type': 'image/jpeg' },
              body: bytes,
            });

            if (!uploadResp.ok) {
              const errText = await uploadResp.text().catch(() => '');
              throw new Error(`R2 upload failed for image ${i}: HTTP ${uploadResp.status} ${errText.slice(0, 150)}`);
            }

            return publicBase
              ? `${publicBase}/${filename}`
              : `/api/photo?key=${encodeURIComponent(filename)}`;
          })
        );

        // Store meta.json in R2
        const shareMetadata = { images: imageUrls, music: music || null, mask: mask || 'none', createdAt: Date.now() };
        const metaUrl = `${baseUrl}/${BUCKET_NAME}/${shareId}/meta.json`;
        const metaResp = await r2.fetch(metaUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shareMetadata),
        });

        if (!metaResp.ok) {
          const errText = await metaResp.text().catch(() => '');
          throw new Error(`Failed to save meta.json to R2: HTTP ${metaResp.status} ${errText.slice(0, 150)}`);
        }

        uploadSuccess = true;

        // Optional KV backup
        if (hasKV) {
          try { await storeInKV(shareId, shareMetadata, cleanAccountId, KV_NAMESPACE_ID, KV_API_TOKEN); } catch (kvErr) { console.warn('KV backup failed:', kvErr); }
        }
      } catch (r2Error: any) {
        console.warn('R2 upload attempt failed:', r2Error?.message || r2Error);

        // Fallback to Cloudflare KV if available
        if (hasKV) {
          try {
            console.info('Attempting fallback to Cloudflare KV...');
            const kvMetadata = {
              images: images,
              music: music || null,
              mask: mask || 'none',
              createdAt: Date.now(),
            };
            await storeInKV(shareId, kvMetadata, cleanAccountId, KV_NAMESPACE_ID, KV_API_TOKEN);
            uploadSuccess = true;
          } catch (kvErr: any) {
            console.error('KV fallback also failed:', kvErr);
            throw r2Error;
          }
        } else {
          throw r2Error;
        }
      }
    } else if (hasKV) {
      // Strategy 2: Direct Cloudflare KV storage (when R2 is not configured)
      const kvMetadata = {
        images: images,
        music: music || null,
        mask: mask || 'none',
        createdAt: Date.now(),
      };
      await storeInKV(shareId, kvMetadata, cleanAccountId, KV_NAMESPACE_ID, KV_API_TOKEN);
      uploadSuccess = true;
    }

    let shareLink = `${origin}/?share=${shareId}`;
    if (mask && mask !== 'none') shareLink += `&mask=${encodeURIComponent(mask)}`;
    if (music && music.url) shareLink += `&music=${encodeURIComponent(music.url)}`;

    return res.status(200).json({ success: true, shareId, shareLink, imageCount: images.length });
  } catch (error: any) {
    console.warn('Upload error, returning graceful fallback:', error?.message);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = req.headers.origin || (host ? `${proto}://${host}` : '');
    const fallbackId = generateShareId();
    let fallbackLink = `${origin}/?share=${fallbackId}`;
    return res.status(200).json({
      success: false,
      fallback: true,
      shareId: fallbackId,
      shareLink: fallbackLink,
      message: error?.message || 'Using local share fallback',
    });
  }
}
