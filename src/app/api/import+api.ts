import { importFromHtml, isSocialUrl, unwrapSocialCaption, type ImportResult } from '@/lib/importer';
import { aiAvailable, aiErrorCode, extractRecipeFromText } from '@/server/ai';
import { FetchError, fetchPage } from '@/server/fetchPage';
import { tooMany } from '@/server/rateLimit';

type Body = { url?: unknown };

/**
 * POST { url } → ImportResult (+ `ai` so the app knows whether AI extraction was an option).
 * Structured recipe data is used when the page has it; AI only fills in when it does not.
 */
export async function POST(request: Request) {
  const limited = tooMany(request, 'import', 30);
  if (limited) return limited;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, reason: 'fetch' }, { status: 400 });
  }
  if (typeof body.url !== 'string' || body.url.length > 2000) {
    return Response.json({ ok: false, reason: 'fetch' }, { status: 400 });
  }
  const ai = aiAvailable();

  let page: { html: string; url: string };
  try {
    page = await fetchPage(body.url);
  } catch (e) {
    const code = e instanceof FetchError ? e.code : 'fetch';
    return Response.json({ ok: false, reason: code === 'blocked' ? 'blocked' : 'fetch', ai });
  }

  const local = importFromHtml(page.html, page.url);
  if (local.ok && local.via === 'structured') return Response.json({ ...local, ai });
  if (!ai) return Response.json({ ...local, ai });

  const summary = !local.ok ? local.summary : undefined;
  const social = isSocialUrl(page.url);
  const caption = summary?.description ? unwrapSocialCaption(summary.description) : '';
  // For social posts only the caption is the author's text; the rest of the page is platform chrome.
  const text = local.ok
    ? [local.draft.title, local.draft.description, ...local.draft.ingredients, ...local.draft.steps].filter(Boolean).join('\n')
    : social
      ? [summary?.title, caption].filter(Boolean).join('\n\n')
      : [summary?.title, summary?.description, summary?.bodyText].filter(Boolean).join('\n\n');
  if (text.trim().length < 40) return Response.json({ ...local, ai });

  try {
    const draft = await extractRecipeFromText(text, `Source: ${page.url}`);
    if (!draft) return Response.json({ ...local, ai });
    const image = local.ok ? local.draft.image : summary?.image;
    const sourceName = local.ok ? local.draft.sourceName : summary?.siteName;
    const result: ImportResult = { ok: true, via: 'ai', draft: { ...draft, image, sourceUrl: page.url, sourceName } };
    return Response.json({ ...result, ai });
  } catch (e) {
    // The no-AI result is still the best answer we have.
    return Response.json({ ...local, ai, aiError: aiErrorCode(e).code });
  }
}
