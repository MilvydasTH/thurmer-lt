import { aiAvailable } from '@/server/ai';
import { offersConfigured } from '@/server/offers';

export function GET() {
  return Response.json({ ok: true, ai: aiAvailable(), offers: offersConfigured() });
}
