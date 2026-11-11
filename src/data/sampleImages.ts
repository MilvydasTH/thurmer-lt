import { FOOD_IMAGES } from './foodImages';

/**
 * Photos bundled with the app for the starter recipes. A recipe refers to one as "sample:<name>",
 * which keeps saved data small and lets the same recipe work on every platform.
 */
const BUNDLED: Record<string, number | string> = {
  'sample:beetroot-soup': require('@/assets/samples/beetroot-soup.jpg'),
  'sample:frikadeller': require('@/assets/samples/frikadeller.jpg'),
  'sample:pasta': require('@/assets/samples/pasta.jpg'),
};

/** Order matches the starter recipes in each language. */
export const SAMPLE_IMAGE_KEYS = ['sample:beetroot-soup', 'sample:frikadeller', 'sample:pasta'];

/** Turns a stored image reference into something an image component can load. */
export function imageSource(uri: string): number | string | { uri: string } {
  if (uri.startsWith('food:')) return FOOD_IMAGES[uri.slice(5)] ?? { uri };
  return BUNDLED[uri] ?? { uri };
}
