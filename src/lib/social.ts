import { decodeEntities, metaContent, stripTags } from './importer';

/** What a social post gives us to work with: the author's full caption, not the shortened preview. */
export interface SocialPost {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook';
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

/**
 * Reads the post text out of Facebook's embed page (the one behind "Embed post"). Long posts
 * keep their tail in a "text_exposed_show" span behind a "See more" link; both halves are in
 * the page, so the ellipsis and the link are dropped and the full text kept.
 */
export function parseFacebookEmbed(html: string): SocialPost | undefined {
  const marker = html.indexOf('data-testid="post_message"');
  if (marker < 0) return undefined;
  const open = html.indexOf('>', marker) + 1;
  // Walk to the div that closes the message, allowing for divs nested inside it.
  let depth = 1;
  let pos = open;
  const tag = /<(\/?)div\b[^>]*>/gi;
  tag.lastIndex = open;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[1] ? -1 : 1;
    pos = m.index;
    if (depth === 0) break;
  }
  if (depth !== 0) return undefined;
  const body = html
    .slice(open, pos)
    .replace(/<span class="text_exposed_hide">[\s\S]*?<\/span>/g, '')
    .replace(/<a[^>]*class="[^"]*see_more_link[^"]*"[\s\S]*?<\/a>/g, '')
    .replace(/<span class="text_exposed_link">[\s\S]*?<\/span>/g, '');
  const text = stripTags(body).trim();
  if (!text) return undefined;
  const image = html.match(/<img[^>]*class="[^"]*scaledImageFit[^"]*"[^>]*\ssrc="([^"]+)"/)?.[1];
  return { platform: 'facebook', text, image: image ? decodeEntities(image) : undefined };
}
