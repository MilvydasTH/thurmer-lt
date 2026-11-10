import { aiAvailable } from '@/server/ai';

export function GET() {
  return Response.json({ ok: true, ai: aiAvailable() });
}
