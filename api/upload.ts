import { getR2Client, getR2BaseUrl, BUCKET_NAME, getCleanAccountId } from './_r2';

const KV_NAMESPACE_ID = (process.env.CLOUDFLARE_KV_NAMESPACE_ID || '').trim().replace(/^["']|["']$/g, '');
const KV_API_TOKEN = (process.env.CLOUDFLARE_KV_API_TOKEN || '').trim().replace(/^["']|["']$/g, '');
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').trim().replace(/^["']|["']$/g, '');

function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function parseBase64Image(base64Data: string): Buffer {
  const base64 = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

async function storeInKV(shareId: string, payload: object, cleanAccountId: string): Promise<void> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${shareId}?expiration_ttl=2592000`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${KV_API_TOKEN}`, 'Content-Type': 'application/json' },
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
    let uploadSuccess = false;

    // Attempt 1: Upload to Cloudflare R2
    try {
      const r2 = getR2Client();
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
      if (KV_NAMESPACE_ID && KV_API_TOKEN && cleanAccountId) {
        try { await storeInKV(shareId, shareMetadata, cleanAccountId); } catch (kvErr) { console.warn('KV backup failed:', kvErr); }
      }
    } catch (r2Error: any) {
      console.warn('R2 upload attempt failed:', r2Error?.message || r2Error);

      // Attempt 2: Fallback to Cloudflare KV if configured (stores base64 images directly)
      if (KV_NAMESPACE_ID && KV_API_TOKEN && cleanAccountId) {
        try {
          console.info('Attempting fallback to Cloudflare KV...');
          const kvMetadata = {
            images: images,
            music: music || null,
            mask: mask || 'none',
            createdAt: Date.now(),
          };
          await storeInKV(shareId, kvMetadata, cleanAccountId);
          uploadSuccess = true;
        } catch (kvErr: any) {
          console.error('KV fallback also failed:', kvErr);
          throw r2Error;
        }
      } else {
        throw r2Error;
      }
    }

    let shareLink = `${origin}/?share=${shareId}`;
    if (mask && mask !== 'none') shareLink += `&mask=${encodeURIComponent(mask)}`;
    if (music && music.url) shareLink += `&music=${encodeURIComponent(music.url)}`;

    return res.status(200).json({ success: true, shareId, shareLink, imageCount: images.length });
  } catch (error: any) {
    console.error('Upload error:', error);
    let msg = error?.message || 'Có lỗi xảy ra khi tải ảnh lên.';
    if (msg.includes('EPROTO') || msg.includes('alert number 40') || msg.includes('handshake failure')) {
      msg = 'Lỗi SSL kết nối tới Cloudflare R2 (Alert 40). Vui lòng kiểm tra biến CLOUDFLARE_ACCOUNT_ID trên Vercel (chỉ điền mã 32 ký tự hex, không điền cả đường dẫn https://).';
    } else if (msg.includes('403') || msg.includes('Access Denied')) {
      msg = 'Lỗi quyền truy cập R2 (HTTP 403 Forbidden). Vui lòng kiểm tra R2 API Token trên Cloudflare có quyền "Object Read & Write" chưa.';
    } else if (msg.includes('404') || msg.includes('NoSuchBucket')) {
      msg = `Bucket R2 không tồn tại (HTTP 404). Vui lòng tạo bucket "${BUCKET_NAME}" trên Cloudflare hoặc đặt đúng biến CLOUDFLARE_R2_BUCKET trên Vercel.`;
    }
    return res.status(500).json({ error: 'Upload failed', message: msg });
  }
}
