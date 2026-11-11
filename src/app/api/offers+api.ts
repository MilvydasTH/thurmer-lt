import { findOffers, offersConfigured } from '@/server/offers';

type Body = { items?: unknown };

/** POST { items: [{ key, name }] } → { ok, byItem, failed } with current Danish leaflet offers per item. */
export async function POST(request: Request) {
  if (!offersConfigured()) return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  if (!Array.isArray(body.items)) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  const items = body.items
    .filter((i): i is { key: string; name: string } => !!i && typeof i.key === 'string' && typeof i.name === 'string')
    .map((i) => ({ key: i.key.slice(0, 120), name: i.name.slice(0, 80) }));
  const result = await findOffers(items);
  return Response.json({ ok: true, ...result });
}
