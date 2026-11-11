import { decodeEntities, metaContent, stripTags } from './importer';

/** What a social post gives us to work with: the author's full caption, not the shortened preview. */
export interface SocialPost {
  platform: 'instagram' | 'tiktok' | 'youtube';
  text: string;
  title?: string;
  author?: string;
  image?: string;
}

export function instagramShortcode(url: string): string | undefined {
  return url.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/i)?.[1];
}

export function youtubeId(url: string): string | undefined {
  return (
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i)?.[1] ??
    url.match(/youtube\.com\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,})/i)?.[1] ??
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/)?.[1]
  );
}

/**
 * Reads the caption out of Instagram's embed page — the page the platform serves for posts
 * embedded on other sites. Unlike the link preview, it carries the whole caption.
 */
export function parseInstagramEmbed(html: string): SocialPost | undefined {
  const start = html.indexOf('class="Caption"');
  if (start < 0) return undefined;
  const open = html.indexOf('>', start) + 1;
  const ends = [html.indexOf('<div class="CaptionComments"', open), html.indexOf('</div>', open)].filter((i) => i > 0);
  if (ends.length === 0) return undefined;
  let body = html.slice(open, Math.min(...ends));
  const author = body.match(/class="CaptionUsername"[^>]*>([^<]+)</)?.[1];
  body = body.replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, '');
  const text = stripTags(body).trim();
  if (!text) return undefined;
  const image = html.match(/class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"/)?.[1];
  return { platform: 'instagram', text, author: author ? decodeEntities(author) : undefined, image: image ? decodeEntities(image) : undefined };
}

/** YouTube keeps the full description in the watch page's player data; the preview tag is cut short. */
export function parseYouTubeWatch(html: string): SocialPost | undefined {
  const raw = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
  if (raw === undefined) return undefined;
  let text: string;
  try {
    text = JSON.parse(`"${raw}"`) as string;
  } catch {
    return undefined;
  }
  if (!text.trim()) return undefined;
  const author = html.match(/"ownerChannelName":"((?:[^"\\]|\\.)*)"/)?.[1];
  return {
    platform: 'youtube',
    text: text.trim(),
    title: metaContent(html, 'og:title'),
    image: metaContent(html, 'og:image'),
    author: author ? (JSON.parse(`"${author}"`) as string) : undefined,
  };
}

/** TikTok's oEmbed answer: the caption is the post's title. */
export function parseTikTokOEmbed(json: unknown): SocialPost | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const o = json as Record<string, unknown>;
  const text = typeof o.title === 'string' ? o.title.trim() : '';
  if (!text) return undefined;
  return {
    platform: 'tiktok',
    text,
    author: typeof o.author_name === 'string' ? o.author_name : undefined,
    image: typeof o.thumbnail_url === 'string' ? o.thumbnail_url : undefined,
  };
}
