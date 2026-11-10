import { Platform } from 'react-native';

import { importFromHtml, isSocialUrl, type ImportResult } from './importer';
import type { Lang, RecipeDraft, RecipeTranslation } from './types';

/**
 * Where the app's server routes live. On web they are same-origin; on a phone, set
 * EXPO_PUBLIC_API_URL to the deployed server (in development the dev server answers relative URLs).
 */
const BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** AbortSignal.timeout is missing on some React Native runtimes, so build the timeout by hand. */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export interface ServerStatus {
  reachable: boolean;
  ai: boolean;
}

let statusCache: { at: number; value: ServerStatus } | undefined;

export async function getServerStatus(force = false): Promise<ServerStatus> {
  if (!force && statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  let value: ServerStatus = { reachable: false, ai: false };
  try {
    const res = await fetch(`${BASE}/api/status`, { signal: timeoutSignal(6000) });
    if (res.ok) {
      const j = (await res.json()) as { ai?: boolean };
      value = { reachable: true, ai: !!j.ai };
    }
  } catch {
    /* offline or no server configured */
  }
  statusCache = { at: Date.now(), value };
  return value;
}

async function post<T>(path: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeoutSignal(timeoutMs),
  });
  return (await res.json()) as T;
}

export type UrlImport = ImportResult & { ai?: boolean };

/**
 * Imports a recipe from a link. On a phone the page is fetched directly first (no server, no cost,
 * works offline from our backend); the server is only asked when that finds nothing.
 * Browsers cannot read other sites' pages, so on web the server does the fetching.
 */
export async function importFromUrl(url: string): Promise<UrlImport> {
  let direct: ImportResult | undefined;
  if (Platform.OS !== 'web' && !isSocialUrl(url)) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'text/html,application/xhtml+xml' },
        signal: timeoutSignal(15_000),
      });
      if (res.ok) {
        direct = importFromHtml(await res.text(), res.url || url);
        if (direct.ok && direct.via === 'structured') return direct;
      }
    } catch {
      /* fall through to the server */
    }
  }
  try {
    return await post<UrlImport>('/api/import', { url });
  } catch {
    return direct ?? { ok: false, reason: 'fetch' };
  }
}

type AiDraft = { ok: true; draft: RecipeDraft } | { ok: false; error: string };

export async function aiParseText(text: string): Promise<AiDraft> {
  try {
    return await post<AiDraft>('/api/ai', { task: 'text', text });
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function aiParseImage(base64: string, mediaType: string): Promise<AiDraft> {
  try {
    return await post<AiDraft>('/api/ai', { task: 'image', base64, mediaType }, 120_000);
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function aiTranslate(
  recipe: { title: string; description?: string; ingredients: string[]; steps: string[]; notes?: string },
  target: Lang,
): Promise<{ ok: true; translation: RecipeTranslation } | { ok: false; error: string }> {
  try {
    return await post('/api/ai', { task: 'translate', target, recipe });
  } catch {
    return { ok: false, error: 'network' };
  }
}
