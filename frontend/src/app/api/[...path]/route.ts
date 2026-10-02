import https from 'node:https';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function proxyRequest(
  method: string,
  path: string,
  headers: Headers,
  body: Buffer | undefined
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'localhost',
      port: 443,
      path,
      method,
      rejectUnauthorized: false,
      headers: {
        ...(headers.get('content-type') ? { 'content-type': headers.get('content-type')! } : {}),
        ...(headers.get('cookie') ? { cookie: headers.get('cookie')! } : {}),
        ...(body ? { 'content-length': body.byteLength } : {}),
        host: 'localhost'
      }
    }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (value === undefined || key === 'set-cookie') continue;
          responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
        for (const cookie of response.headers['set-cookie'] ?? []) {
          responseHeaders.append('set-cookie', cookie);
        }
        resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode ?? 502,
          headers: responseHeaders
        }));
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function handler(request: Request, context: RouteContext) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not found', { status: 404 });
  }

  const { path } = await context.params;
  const url = new URL(request.url);
  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : Buffer.from(await request.arrayBuffer());

  try {
    return await proxyRequest(
      request.method,
      `/api/${path.join('/')}${url.search}`,
      request.headers,
      body
    );
  } catch {
    return new Response('Local API proxy unavailable', { status: 502 });
  }
}

export const GET = handler;
export const HEAD = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
