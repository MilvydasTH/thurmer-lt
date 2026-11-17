import type { FamilyRequest } from '@/lib/familyTypes';
import { handleFamily } from '@/server/family';
import { defaultKV } from '@/server/kv';
import { tooMany } from '@/server/rateLimit';

/** POST: create a family, join one with its code, sync recipes, or leave. */
export async function POST(request: Request) {
  let body: FamilyRequest;
  try {
    body = (await request.json()) as FamilyRequest;
  } catch {
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  // Joining is where a code could be guessed, so it gets the tightest limit.
  const limited = body?.action === 'join' || body?.action === 'create' ? tooMany(request, 'family-join', 8) : tooMany(request, 'family', 90);
  if (limited) return limited;
  try {
    const res = await handleFamily(defaultKV(), body);
    return Response.json(res, { status: res.ok ? 200 : res.error === 'not_found' || res.error === 'not_member' ? 404 : 400 });
  } catch {
    return Response.json({ ok: false, error: 'storage' }, { status: 503 });
  }
}
