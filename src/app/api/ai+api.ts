import { tooMany } from '@/server/rateLimit';
import { aiAvailable, aiErrorCode, extractRecipeFromImage, extractRecipeFromText, translateRecipe } from '@/server/ai';

type Body =
  | { task: 'text'; text: string }
  | { task: 'image'; base64: string; mediaType?: string }
  | { task: 'translate'; target: string; recipe: { title: string; description?: string; ingredients: string[]; steps: string[]; notes?: string } };

const MAX_TEXT = 40_000;
const MAX_IMAGE_B64 = 7_000_000;

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export async function POST(request: Request) {
  if (!aiAvailable()) return Response.json({ ok: false, error: 'no_ai' }, { status: 503 });
  // AI calls cost money: a tight per-minute limit and a daily ceiling per visitor.
  const limited = tooMany(request, 'ai', 8) ?? tooMany(request, 'ai-day', 150, 24 * 60 * 60_000);
  if (limited) return limited;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  try {
    if (body.task === 'text') {
      if (typeof body.text !== 'string' || !body.text.trim()) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
      if (body.text.length > MAX_TEXT) return Response.json({ ok: false, error: 'too_large' }, { status: 413 });
      const draft = await extractRecipeFromText(body.text);
      return Response.json(draft ? { ok: true, draft } : { ok: false, error: 'no_recipe' });
    }
    if (body.task === 'image') {
      if (typeof body.base64 !== 'string' || !body.base64) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
      if (body.base64.length > MAX_IMAGE_B64) return Response.json({ ok: false, error: 'too_large' }, { status: 413 });
      const mediaType = body.mediaType === 'image/png' || body.mediaType === 'image/webp' ? body.mediaType : 'image/jpeg';
      const draft = await extractRecipeFromImage(body.base64, mediaType);
      return Response.json(draft ? { ok: true, draft } : { ok: false, error: 'no_recipe' });
    }
    if (body.task === 'translate') {
      const r = body.recipe;
      if (!r || typeof r.title !== 'string' || !isStrings(r.ingredients) || !isStrings(r.steps) || !['en', 'da', 'lt'].includes(body.target)) {
        return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
      }
      if (JSON.stringify(r).length > MAX_TEXT) return Response.json({ ok: false, error: 'too_large' }, { status: 413 });
      const translation = await translateRecipe(
        { title: r.title, description: r.description, ingredients: r.ingredients, steps: r.steps, notes: r.notes },
        body.target,
      );
      return Response.json({ ok: true, translation });
    }
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  } catch (e) {
    const { code, status } = aiErrorCode(e);
    return Response.json({ ok: false, error: code }, { status });
  }
}
