import { hostName } from '@/lib/importer';
import { instagramShortcode, parseInstagramEmbed, parseTikTokOEmbed, parseYouTubeWatch, youtubeId, type SocialPost } from '@/lib/social';

import { APP_USER_AGENT } from './fetchPage';

async function get(url: string, accept: string): Promise<Response | undefined> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: { 'user-agent': APP_USER_AGENT, accept, 'accept-language': 'en,da;q=0.9,lt;q=0.8' },
    });
    return res.ok ? res : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetches a social post's full caption through the route each platform offers for showing
 * posts elsewhere (embed page or oEmbed). Returns undefined when the platform does not answer,
 * the post is private, or the link is not a post we recognise.
 */
export async function fetchSocialPost(url: string): Promise<SocialPost | undefined> {
  const host = hostName(url);

  if (/(^|\.)instagram\.com$/i.test(host)) {
    let code = instagramShortcode(url);
    if (!code) {
      // Share links (instagram.com/share/...) redirect to the post.
      const res = await get(url, 'text/html');
      code = res ? instagramShortcode(res.url) : undefined;
    }
    if (!code) return undefined;
    const res = await get(`https://www.instagram.com/p/${code}/embed/captioned/`, 'text/html');
    return res ? parseInstagramEmbed(await res.text()) : undefined;
  }

  if (/(^|\.)(youtube\.com|youtu\.be)$/i.test(host)) {
    const id = youtubeId(url);
    if (!id) return undefined;
    const res = await get(`https://www.youtube.com/watch?v=${id}`, 'text/html');
    return res ? parseYouTubeWatch(await res.text()) : undefined;
  }

  if (/(^|\.)tiktok\.com$/i.test(host)) {
    const res = await get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, 'application/json');
    if (!res) return undefined;
    try {
      return parseTikTokOEmbed(await res.json());
    } catch {
      return undefined;
    }
  }

  return undefined;
}
