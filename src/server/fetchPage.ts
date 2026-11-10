import { isSocialUrl } from '@/lib/importer';

const MAX_BYTES = 3_000_000;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
/** Social platforms serve caption metadata to link-preview crawlers that they hide from browsers. */
const PREVIEW_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

export class FetchError extends Error {
  constructor(public code: 'bad_url' | 'blocked' | 'fetch' | 'not_html') {
    super(code);
  }
}

/** Fetches a public web page for import. Refuses private addresses so the endpoint can't be used to probe a network. */
export async function fetchPage(rawUrl: string): Promise<{ html: string; url: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchError('bad_url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new FetchError('bad_url');
  const allowLocal = process.env.SKANU_ALLOW_LOCAL_IMPORT === '1';

  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    if (!allowLocal && isPrivateHost(current.hostname)) throw new FetchError('bad_url');
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(12_000),
        headers: {
          'user-agent': isSocialUrl(current.toString()) ? PREVIEW_UA : BROWSER_UA,
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en,da;q=0.9,lt;q=0.8',
        },
      });
    } catch {
      throw new FetchError('fetch');
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new FetchError('fetch');
      current = new URL(loc, current);
      if (current.protocol !== 'http:' && current.protocol !== 'https:') throw new FetchError('bad_url');
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429) throw new FetchError('blocked');
    if (!res.ok) throw new FetchError('fetch');
    const type = res.headers.get('content-type') ?? '';
    if (type && !/html|xml|text\/plain/i.test(type)) throw new FetchError('not_html');
    const buf = await res.arrayBuffer();
    const html = new TextDecoder('utf-8').decode(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf);
    return { html, url: current.toString() };
  }
  throw new FetchError('fetch');
}
