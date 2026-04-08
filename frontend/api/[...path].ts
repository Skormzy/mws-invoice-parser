import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const backendUrl = 'https://mws-invoice-parser-api.onrender.com';
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path || '';
  const targetUrl = `${backendUrl}/api/${path}`;

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string' && key !== 'host') {
      headers[key] = value;
    }
  }

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // For multipart/form-data (file uploads), pipe the raw body
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        const chunks: Buffer[] = [];
        for await (const chunk of req as any) {
          chunks.push(Buffer.from(chunk));
        }
        fetchOptions.body = Buffer.concat(chunks);
      } else {
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Forward response headers
    response.headers.forEach((value, key) => {
      if (key !== 'content-encoding') {
        res.setHeader(key, value);
      }
    });

    res.status(response.status);

    // Handle binary responses (Excel export)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('spreadsheet') || contentType.includes('octet-stream')) {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ detail: 'Backend unavailable' });
  }
}
