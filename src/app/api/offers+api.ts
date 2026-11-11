import { findOffers, offersConfigured } from '@/server/offers';
import { tooMany } from '@/server/rateLimit';

type Body = { items?: unknown; near?: unknown };

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
  if (!Array.isArray(body.items)) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  const items = body.items
    .filter((i): i is { key: string; name: string } => !!i && typeof i.key === 'string' && typeof i.name === 'string')
    .map((i) => ({ key: i.key.slice(0, 120), name: i.name.slice(0, 80) }));
  const n = body.near as { lat?: unknown; lng?: unknown } | undefined;
  const near =
    n && typeof n.lat === 'number' && typeof n.lng === 'number' && Math.abs(n.lat) <= 90 && Math.abs(n.lng) <= 180
      ? { lat: n.lat, lng: n.lng }
      : undefined;
  const result = await findOffers(items, near);
  return Response.json({ ok: true, ...result });
}
