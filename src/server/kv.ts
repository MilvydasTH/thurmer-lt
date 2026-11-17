/**
 * Where the family libraries are kept. Two back ends behind one small interface:
 *
 * - Upstash Redis over HTTPS, when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 *   This is the one to use when the server is deployed; it works from any host.
 * - JSON files in a folder (SKANU_DATA_DIR, default ".data"), for development and for a
 *   single Node server with a disk.
 */
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

function upstash(url: string, token: string): KV {
  const run = async (command: string[]): Promise<unknown> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`storage ${res.status}`);
    return ((await res.json()) as { result?: unknown }).result;
  };
  return {
    get: async (key) => {
      const v = await run(['GET', key]);
      return typeof v === 'string' ? v : null;
    },
    set: async (key, value) => {
      await run(['SET', key, value]);
    },
    del: async (key) => {
      await run(['DEL', key]);
    },
  };
}

function files(dir: string): KV {
  const path = (key: string) => `${dir}/${key.replace(/[^A-Za-z0-9_-]/g, '_')}.json`;
  const fs = () => import('node:fs/promises');
  return {
    get: async (key) => {
      try {
        return await (await fs()).readFile(path(key), 'utf8');
      } catch {
        return null;
      }
    },
    set: async (key, value) => {
      const f = await fs();
      await f.mkdir(dir, { recursive: true });
      // Write-then-rename, so a crash mid-write cannot leave half a file behind.
      const tmp = `${path(key)}.${Date.now()}.tmp`;
      await f.writeFile(tmp, value, 'utf8');
      await f.rename(tmp, path(key));
    },
    del: async (key) => {
      try {
        await (await fs()).unlink(path(key));
      } catch {
        /* already gone */
      }
    },
  };
}

/** For tests. */
export function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    del: async (k) => void m.delete(k),
  };
}

let store: KV | undefined;

export function defaultKV(): KV {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? upstash(url.replace(/\/$/, ''), token) : files(process.env.SKANU_DATA_DIR || '.data');
  return store;
}
