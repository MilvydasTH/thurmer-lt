import { findOffers, offersConfigured, searchOffers } from '@/server/offers';
import { tooMany } from '@/server/rateLimit';

type Body = { items?: unknown; near?: unknown; query?: unknown };

/** POST { items: [{ key, name }] } → { ok, byItem, failed } with current Danish leaflet offers per item. */
export async function POST(request: Request) {
  if (!offersConfigured()) return Response.json({ ok: false, error: 'not_configured' }, { status: 503 });
  const limited = tooMany(request, 'offers', 20);
  if (limited) return limited;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  const n0 = body.near as { lat?: unknown; lng?: unknown } | undefined;
  const where =
    n0 && typeof n0.lat === 'number' && typeof n0.lng === 'number' && Math.abs(n0.lat) <= 90 && Math.abs(n0.lng) <= 180
      ? { lat: n0.lat, lng: n0.lng }
      : undefined;
  // { query } is the offers finder: one free-text search instead of a list of cart items.
  if (typeof body.query === 'string') {
    try {
      return Response.json({ ok: true, offers: await searchOffers(body.query.slice(0, 80), where) });
    } catch {
      return Response.json({ ok: false, error: 'upstream' }, { status: 502 });
    }
  }
  if (!Array.isArray(body.items)) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  const items = body.items
    .filter((i): i is { key: string; name: string } => !!i && typeof i.key === 'string' && typeof i.name === 'string')
    .map((i) => ({ key: i.key.slice(0, 120), name: i.name.slice(0, 80) }));
  const result = await findOffers(items, where);
  return Response.json({ ok: true, ...result });
}
