// Local stand-in for Vercel's serverless functions: serves /api/<name> from api/<name>.ts inside
// the Vite dev server, with the same req.query / req.body / res.status().json() helpers.
// Development only — never part of a build. (The Vercel CLI is off-limits: it creates a
// separate project.)

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return undefined;
  if ((req.headers['content-type'] ?? '').includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

export function devApi(): Plugin {
  return {
    name: 'beekeeper-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const m = /^\/api\/([a-z0-9-]+)\/?$/.exec(url.pathname);
        if (!m) return next();
        const file = resolve('api', `${m[1]}.ts`);
        if (!existsSync(file)) {
          res.statusCode = 404;
          return res.end('Not found');
        }
        try {
          const mod = await server.ssrLoadModule(file);
          const query: Record<string, string | string[]> = {};
          for (const [k, v] of url.searchParams) {
            const prev = query[k];
            query[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
          }
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
          const vreq = Object.assign(req, { query, body, cookies: {} });
          const vres = Object.assign(res, {
            status(code: number) {
              res.statusCode = code;
              return vres;
            },
            json(obj: unknown) {
              if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(obj));
              return vres;
            },
            send(b: unknown) {
              if (b !== null && typeof b === 'object' && !Buffer.isBuffer(b)) return vres.json(b);
              res.end(b as string | Buffer);
              return vres;
            },
          });
          await mod.default(vreq, vres);
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          console.error(err);
          if (!res.headersSent) res.statusCode = 500;
          res.end('Local API error: ' + (err as Error).message);
        }
      });
    },
  };
}
