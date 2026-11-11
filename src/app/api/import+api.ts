import { importFromHtml, isSocialUrl, unwrapSocialCaption, type ImportResult } from '@/lib/importer';
import { isUsableDraft, parseRecipeText } from '@/lib/parseText';
import { aiAvailable, aiErrorCode, extractRecipeFromText } from '@/server/ai';
import { FetchError, fetchPage } from '@/server/fetchPage';
import { fetchSocialPost } from '@/server/social';
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

  // Social posts: read the full caption through the platform's embed data. The ordinary link
  // preview is cut off where the app shows "more", which loses most of a recipe.
  if (isSocialUrl(body.url)) {
    const post = await fetchSocialPost(body.url);
    if (post) {
      const base = { image: post.image, sourceUrl: body.url, sourceName: post.author ?? post.platform };
      const parsed = parseRecipeText(post.title ? `${post.title}\n${post.text}` : post.text);
      if (isUsableDraft(parsed)) {
        const result: ImportResult = { ok: true, via: 'caption', partial: true, draft: { ...parsed, ...base, title: parsed.title || post.title || '' } };
        return Response.json({ ...result, ai });
      }
      if (ai && post.text.length >= 40) {
        try {
          const draft = await extractRecipeFromText(post.text, `Source: ${body.url}`);
          if (draft) return Response.json({ ok: true, via: 'ai', draft: { ...draft, ...base }, ai });
        } catch {
          /* fall through: hand the caption back so the person can use it as text */
        }
      }
      return Response.json({ ok: false, reason: 'norecipe', summary: { title: post.title, description: post.text, image: post.image, siteName: post.platform, bodyText: '' }, ai });
    }
  }

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
