import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const backendUrl = 'https://mws-invoice-parser-api.onrender.com';

  // Build the target URL - strip /api/proxy prefix, keep the rest
  const url = new URL(req.url || '', `https://${req.headers.host}`);
  const targetPath = url.pathname.replace('/api/proxy', '/api');
  const targetUrl = `${backendUrl}${targetPath}${url.search}`;

  try {
    // Collect raw body for non-GET requests
    let body: Buffer | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string' && key !== 'host' && key !== 'connection') {
        headers[key] = value;
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    // Forward response headers
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key)) {
        res.setHeader(key, value);
      }
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.status(response.status).send(buffer);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ detail: 'Backend unavailable' });
  }
}
