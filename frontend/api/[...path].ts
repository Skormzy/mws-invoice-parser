import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const backend = 'https://mws-invoice-parser-api.onrender.com';
  const url = new URL(req.url || '', `https://${req.headers.host}`);
  const target = `${backend}${url.pathname}${url.search}`;

  try {
    let body: Buffer | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
    }

    const headers: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (typeof val === 'string' && !['host', 'connection'].includes(key)) {
        headers[key] = val;
      }
    }

    const resp = await fetch(target, { method: req.method, headers, body });

    resp.headers.forEach((v, k) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(k)) {
        res.setHeader(k, v);
      }
    });

    const buf = Buffer.from(await resp.arrayBuffer());
    res.status(resp.status).send(buf);
  } catch (e) {
    console.error('Proxy error:', e);
    res.status(502).json({ detail: 'Backend unavailable' });
  }
}
