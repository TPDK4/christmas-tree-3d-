import { AwsClient } from 'aws4fetch';

const DEFAULT_ACCOUNT_ID = '59aa662515a87635e7f868ccb1590294';
const DEFAULT_ACCESS_KEY_ID = 'f4c9eb72e1fe834ed82bf359037d5d5e';
const DEFAULT_SECRET_ACCESS_KEY = '23dce2ed7ed391ef11f7cf7b526efd00e03e0dbd7a1b8f53a7ba8409905cbdae';
const DEFAULT_BUCKET_NAME = 'christmas-tree-photos';
const KVDB_BUCKET_ID = '4pNmK8yZ3tWq7vR2uLxE5j';

function getCleanAccountId(): string {
  let id = (
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID_1 ||
    process.env.CF_ACCOUNT_ID ||
    process.env.ACCOUNT_ID ||
    DEFAULT_ACCOUNT_ID
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
  return id || DEFAULT_ACCOUNT_ID;
}

const BUCKET_NAME = (
  process.env.CLOUDFLARE_R2_BUCKET ||
  process.env.R2_BUCKET ||
  DEFAULT_BUCKET_NAME
).trim().replace(/^["']|["']$/g, '').replace(/^\/+|\/+$/g, '') || DEFAULT_BUCKET_NAME;

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
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function getR2Credentials() {
  const accessKeyId = (
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID_1 ||
    process.env.R2_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    DEFAULT_ACCESS_KEY_ID
  ).trim().replace(/^["']|["']$/g, '') || DEFAULT_ACCESS_KEY_ID;

  const secretAccessKey = (
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY_1 ||
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    DEFAULT_SECRET_ACCESS_KEY
  ).trim().replace(/^["']|["']$/g, '') || DEFAULT_SECRET_ACCESS_KEY;

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

async function uploadToCatbox(base64Data: string): Promise<string> {
  const boundary = `----CatboxBoundary${Date.now()}${Math.random().toString(36).substring(2)}`;
  const base64 = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
  const imgBuf = Buffer.from(base64, 'base64');
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="reqtype"\r\n\r\n` +
    `fileupload\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="fileToUpload"; filename="photo.jpg"\r\n` +
    `Content-Type: image/jpeg\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, imgBuf, tail]);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: body,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Catbox HTTP ${res.status}`);
    const text = await res.text();
    const url = text.trim();
    if (!url.startsWith('http')) throw new Error(`Catbox error: ${url}`);
    return url;
  } finally {
    clearTimeout(timer);
  }
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

async function storeInKVDB(shareId: string, payload: object): Promise<boolean> {
  try {
    const res = await fetch(`https://kvdb.io/${KVDB_BUCKET_ID}/${shareId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.warn('KVDB store failed:', e);
    return false;
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

    let uploadSuccess = false;
    let imageUrls: string[] = [];
    let imageCodes: string[] = [];

    // Strategy 1: Upload to Cloudflare R2 if configured
    if (hasR2) {
      try {
        const r2 = new AwsClient({ accessKeyId, secretAccessKey, region: 'auto', service: 's3' });
        const baseUrl = getR2BaseUrl();

        imageUrls = await Promise.all(
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
        console.warn('R2 upload failed, transitioning to Catbox Cloud CDN fallback:', r2Error?.message || r2Error);
      }
    }

    // Strategy 2: Fast Public Cloud CDN (Catbox) - 100% reliable, permanent cross-device image hosting
    if (!uploadSuccess) {
      try {
        console.info(`Uploading ${images.length} images to Catbox CDN...`);
        imageUrls = await Promise.all(
          images.map((img: string) => uploadToCatbox(img))
        );
        imageCodes = imageUrls.map((u) => {
          const m = u.match(/files\.catbox\.moe\/([a-zA-Z0-9_-]+)\./);
          return m ? m[1] : u;
        });
        uploadSuccess = true;
        console.info(`Catbox upload succeeded with codes: ${imageCodes.join(',')}`);
      } catch (catboxErr: any) {
        console.warn('Catbox upload failed:', catboxErr?.message || catboxErr);
      }
    }

    // Strategy 3: Cloudflare KV (if configured and Catbox failed)
    if (!uploadSuccess && hasKV) {
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
        console.warn('KV fallback failed:', kvErr);
      }
    }

    // Strategy 4: KVDB cloud store
    if (!uploadSuccess) {
      try {
        console.info('Attempting fallback to KVDB cloud store...');
        const kvdbMetadata = {
          images: images.map((_: any, i: number) => `/api/photo?key=${encodeURIComponent(`${shareId}/${i}.jpg`)}`),
          rawImages: images,
          music: music || null,
          mask: mask || 'none',
          createdAt: Date.now(),
        };
        uploadSuccess = await storeInKVDB(shareId, kvdbMetadata);
      } catch (kvdbErr: any) {
        console.warn('KVDB lookup failed:', kvdbErr?.message);
      }
    }

    let shareLink = `${origin}/?share=${shareId}`;
    if (imageCodes.length > 0) {
      shareLink += `&imgs=${imageCodes.join(',')}`;
    }
    if (mask && mask !== 'none') shareLink += `&mask=${encodeURIComponent(mask)}`;
    if (music && music.url) shareLink += `&music=${encodeURIComponent(music.url)}`;

    return res.status(200).json({
      success: uploadSuccess,
      shareId,
      shareLink,
      images: imageUrls,
      imageCodes,
      imageCount: images.length,
    });
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
