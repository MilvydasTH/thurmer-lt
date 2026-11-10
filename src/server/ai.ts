import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import type { RecipeDraft, RecipeTranslation } from '@/lib/types';

/** Server-only. The key never reaches the app bundle. */
export function aiAvailable(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const MODEL = process.env.SKANU_AI_MODEL || 'claude-opus-5-5';

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic());

const RecipeSchema = z.object({
  found: z.boolean().describe('false when the content does not contain a recipe'),
  title: z.string(),
  description: z.string().describe('One or two sentences, or an empty string'),
  language: z.string().describe('ISO 639-1 code of the language the recipe is written in'),
  servings: z.number().describe('0 when not stated'),
  prepMinutes: z.number().describe('0 when not stated'),
  cookMinutes: z.number().describe('0 when not stated'),
  ingredients: z.array(z.string()).describe('One ingredient per entry with its amount, e.g. "200 g flour"'),
  steps: z.array(z.string()).describe('One instruction per entry, without numbering'),
  tags: z.array(z.string()),
});

const TranslationSchema = z.object({
  title: z.string(),
  description: z.string(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
  notes: z.string(),
});

const EXTRACT_SYSTEM = `You extract cooking recipes for a recipe-keeper app.

The user's content is a web page, a social media caption, a pasted note, or a photo of a recipe. Pull out the recipe exactly as the author wrote it.

Keep the recipe in its original language — never translate. Keep the author's amounts and units as written; the app converts units itself. Do not invent ingredients, amounts, or steps that are not in the source: a faithful partial recipe is more useful to the cook than a complete-looking guess. If amounts are missing in the source, list the ingredient without one.

Ignore everything that is not the recipe: greetings, hashtags, calls to follow or subscribe, adverts, comments, navigation text.

If there is no recipe in the content, set found to false and leave the other fields empty.`;

export class AiRefusal extends Error {}

function toDraft(r: z.infer<typeof RecipeSchema>): RecipeDraft | null {
  if (!r.found || (r.ingredients.length === 0 && r.steps.length === 0)) return null;
  return {
    title: r.title,
    description: r.description || undefined,
    lang: r.language ? r.language.slice(0, 2).toLowerCase() : undefined,
    servings: r.servings > 0 ? Math.round(r.servings) : undefined,
    prepMin: r.prepMinutes > 0 ? Math.round(r.prepMinutes) : undefined,
    cookMin: r.cookMinutes > 0 ? Math.round(r.cookMinutes) : undefined,
    ingredients: r.ingredients,
    steps: r.steps,
    tags: r.tags.slice(0, 8),
  };
}

async function extract(content: Anthropic.MessageParam['content']): Promise<RecipeDraft | null> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'low', format: zodOutputFormat(RecipeSchema) },
  });
  if (response.stop_reason === 'refusal') throw new AiRefusal('refusal');
  return response.parsed_output ? toDraft(response.parsed_output) : null;
}

export function extractRecipeFromText(text: string, context?: string): Promise<RecipeDraft | null> {
  const body = context ? `${context}\n\n<content>\n${text}\n</content>` : `<content>\n${text}\n</content>`;
  return extract(body);
}

export function extractRecipeFromImage(base64: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<RecipeDraft | null> {
  return extract([
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: 'This is a photo or screenshot of a recipe. Extract it.' },
  ]);
}

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', da: 'Danish', lt: 'Lithuanian' };

export async function translateRecipe(
  recipe: Pick<RecipeDraft, 'title' | 'description' | 'ingredients' | 'steps' | 'notes'>,
  target: string,
): Promise<RecipeTranslation> {
  const language = LANGUAGE_NAMES[target] ?? target;
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: `You translate cooking recipes into ${language} for a home cook who reads ${language} natively.

Use the ingredient names and kitchen vocabulary a ${language} cookbook would use. Keep every amount and unit exactly as given — do not convert units, the app does that separately. Return the same number of ingredients and steps, in the same order, so the app can line the translation up with the original. Keep dish names that have no real equivalent in their original form.`,
    messages: [{ role: 'user', content: JSON.stringify(recipe) }],
    output_config: { effort: 'low', format: zodOutputFormat(TranslationSchema) },
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new AiRefusal('refusal');
  const t = response.parsed_output;
  return {
    title: t.title,
    description: t.description || undefined,
    ingredients: t.ingredients,
    steps: t.steps,
    notes: t.notes || undefined,
  };
}

/** Maps SDK errors to a short code the app can show a sensible message for. */
export function aiErrorCode(error: unknown): { code: string; status: number } {
  if (error instanceof AiRefusal) return { code: 'refused', status: 422 };
  if (error instanceof Anthropic.AuthenticationError) return { code: 'ai_auth', status: 502 };
  if (error instanceof Anthropic.RateLimitError) return { code: 'ai_busy', status: 503 };
  if (error instanceof Anthropic.APIError) return { code: 'ai_error', status: 502 };
  return { code: 'error', status: 500 };
}
