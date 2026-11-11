import { describe, expect, it } from 'vitest';

import { aisleFor, foodsMentioned, matchFood } from '../src/data/foods';
import { convertQty, convertTemperatures, displayIngredient, formatQty } from '../src/lib/convert';
import { extractJsonLdRecipe, firstUrl, importFromHtml, isoDurationToMinutes, isSocialUrl, unwrapSocialCaption } from '../src/lib/importer';
import { estimateNutrition } from '../src/lib/nutrition';
import { formatPrice, offerQuery, parseOffers, pickOffers, storeCoverage } from '../src/lib/offers';
import { parseRecipeText } from '../src/lib/parseText';
import { instagramShortcode, parseInstagramEmbed, parseTikTokOEmbed, parseYouTubeWatch, youtubeId } from '../src/lib/social';
import fixture from './fixtures/tjek-offers.json';
import { findTimers, formatClock } from '../src/lib/timers';
import { parseIngredient, parseIngredientLines } from '../src/lib/units';

const p = (s: string) => {
  const { qty, qtyMax, unit, name, header } = parseIngredient(s);
  return { qty, qtyMax, unit, name, header };
};

describe('parseIngredient', () => {
  it('parses English lines', () => {
    expect(p('1 1/2 cups all-purpose flour')).toMatchObject({ qty: 1.5, unit: 'cup', name: 'all-purpose flour' });
    expect(p('½ tsp salt')).toMatchObject({ qty: 0.5, unit: 'tsp', name: 'salt' });
    expect(p('2 large eggs')).toMatchObject({ qty: 2, unit: undefined, name: 'large eggs' });
    expect(p('200g butter, softened')).toMatchObject({ qty: 200, unit: 'g', name: 'butter, softened' });
    expect(p('2-3 tbsp olive oil')).toMatchObject({ qty: 2, qtyMax: 3, unit: 'tbsp', name: 'olive oil' });
    expect(p('- 1 cup of milk')).toMatchObject({ qty: 1, unit: 'cup', name: 'milk' });
    expect(p('8 fl oz cream')).toMatchObject({ qty: 8, unit: 'floz', name: 'cream' });
    expect(p('Salt to taste')).toMatchObject({ qty: undefined, name: 'Salt to taste' });
  });
  it('does not mistake words for units', () => {
    expect(p('2 lemons')).toMatchObject({ qty: 2, unit: undefined, name: 'lemons' });
    expect(p('3 garlic cloves')).toMatchObject({ qty: 3, unit: undefined, name: 'garlic cloves' });
    expect(p('1 can chickpeas')).toMatchObject({ qty: 1, unit: 'can', name: 'chickpeas' });
  });
  it('parses Danish lines', () => {
    expect(p('2 spsk smør')).toMatchObject({ qty: 2, unit: 'tbsp', name: 'smør' });
    expect(p('1,5 dl mælk')).toMatchObject({ qty: 1.5, unit: 'dl', name: 'mælk' });
    expect(p('1 tsk. salt')).toMatchObject({ qty: 1, unit: 'tsp', name: 'salt' });
    expect(p('2 fed hvidløg')).toMatchObject({ qty: 2, unit: 'clove', name: 'hvidløg' });
    expect(p('500 g hakket oksekød')).toMatchObject({ qty: 500, unit: 'g', name: 'hakket oksekød' });
  });
  it('parses Lithuanian lines', () => {
    expect(p('200 g miltų')).toMatchObject({ qty: 200, unit: 'g', name: 'miltų' });
    expect(p('2 v. š. cukraus')).toMatchObject({ qty: 2, unit: 'tbsp', name: 'cukraus' });
    expect(p('1 a.š. druskos')).toMatchObject({ qty: 1, unit: 'tsp', name: 'druskos' });
    expect(p('3 vnt. kiaušinių')).toMatchObject({ qty: 3, unit: 'piece', name: 'kiaušinių' });
    expect(p('1 stiklinė pieno')).toMatchObject({ qty: 1, unit: 'cup', name: 'pieno' });
    expect(p('2 skiltelės česnako')).toMatchObject({ qty: 2, unit: 'clove', name: 'česnako' });
  });
  it('detects section headers', () => {
    expect(p('For the sauce:')).toMatchObject({ header: true, name: 'For the sauce' });
  });
  it('keeps the raw line', () => {
    expect(parseIngredientLines(['• 2 cups flour', '', '  1 egg '])).toHaveLength(2);
    expect(parseIngredient('• 2 cups flour').raw).toBe('2 cups flour');
  });
});

describe('food matching', () => {
  it('prefers the most specific food', () => {
    expect(matchFood('extra virgin olive oil')?.id).toBe('oliveoil');
    expect(matchFood('brown sugar')?.id).toBe('brownsugar');
    expect(matchFood('coconut milk')?.id).toBe('coconutmilk');
    expect(matchFood('sweet potatoes')?.id).toBe('sweetpotato');
  });
  it('matches Danish and Lithuanian names', () => {
    expect(matchFood('hvedemel')?.id).toBe('flour');
    expect(matchFood('hakket oksekød')?.id).toBe('mincedbeef');
    expect(matchFood('miltų')?.id).toBe('flour');
    expect(matchFood('kiaušinių')?.id).toBe('egg');
    expect(matchFood('grietinėlės')?.id).toBe('cream');
    expect(matchFood('grietinės')?.id).toBe('sourcream');
    expect(matchFood('alyvuogių aliejaus')?.id).toBe('oliveoil');
    expect(matchFood('burokėlių')?.id).toBe('beetroot');
  });
  it('does not match inside other words', () => {
    expect(matchFood('melon')?.id).toBeUndefined();
    expect(matchFood('watermelon')).toBeUndefined();
  });
  it('assigns aisles', () => {
    expect(aisleFor('2 red onions')).toBe('produce');
    expect(aisleFor('smør')).toBe('dairy');
    expect(aisleFor('druskos')).toBe('spices');
    expect(aisleFor('dishwasher tablets')).toBe('other');
  });
});

describe('conversion', () => {
  const metric = { system: 'metric' as const, useDl: false };
  it('converts US units to metric', () => {
    expect(convertQty(1, 'lb', 'beef', metric)).toEqual({ qty: 455, unit: 'g' });
    expect(convertQty(8, 'oz', 'pasta', metric)).toEqual({ qty: 225, unit: 'g' });
    expect(convertQty(1, 'cup', 'milk', metric)).toEqual({ qty: 240, unit: 'ml' });
    expect(convertQty(1, 'cup', 'milk', { system: 'metric', useDl: true })).toEqual({ qty: 2.5, unit: 'dl' });
  });
  it('converts cups of dry goods to grams', () => {
    expect(convertQty(2, 'cup', 'all-purpose flour', metric)).toEqual({ qty: 250, unit: 'g' });
    expect(convertQty(1, 'cup', 'sugar', metric)).toEqual({ qty: 200, unit: 'g' });
  });
  it('converts metric to US', () => {
    expect(convertQty(240, 'ml', 'milk', { system: 'us', useDl: false })).toEqual({ qty: 1, unit: 'cup' });
    expect(convertQty(454, 'g', 'beef', { system: 'us', useDl: false })).toEqual({ qty: 1, unit: 'lb' });
  });
  it('formats quantities', () => {
    expect(formatQty(1.5, 'cup', 'en')).toBe('1 ½');
    expect(formatQty(0.5, 'tsp', 'en')).toBe('½');
    expect(formatQty(2.5, 'dl', 'da')).toBe('2,5');
    expect(formatQty(4.5, undefined, 'lt')).toBe('4 ½');
    expect(formatQty(3, undefined, 'en')).toBe('3');
  });
  it('leaves the original line alone when nothing changes', () => {
    const ing = parseIngredient('2 spsk smør');
    expect(displayIngredient(ing, { scale: 1, system: 'metric', useDl: true, lang: 'en' })).toBe('2 spsk smør');
  });
  it('scales and converts for display', () => {
    const flour = parseIngredient('1 cup flour');
    expect(displayIngredient(flour, { scale: 2, system: 'metric', useDl: false, lang: 'en' })).toBe('250 g flour');
    const eggs = parseIngredient('3 eggs');
    expect(displayIngredient(eggs, { scale: 1.5, system: 'original', useDl: false, lang: 'en' })).toBe('4 ½ eggs');
    const milk = parseIngredient('2 cups milk');
    expect(displayIngredient(milk, { scale: 1, system: 'metric', useDl: true, lang: 'da' })).toBe('5 dl milk');
    const range = parseIngredient('2-3 tbsp olive oil');
    expect(displayIngredient(range, { scale: 2, system: 'original', useDl: false, lang: 'en' })).toBe('4–6 tbsp olive oil');
  });
  it('converts oven temperatures', () => {
    expect(convertTemperatures('Bake at 350°F for 20 minutes', 'metric')).toBe('Bake at 175 °C for 20 minutes');
    expect(convertTemperatures('Preheat oven to 400 degrees F.', 'metric')).toBe('Preheat oven to 205 °C.');
    expect(convertTemperatures('Bag ved 200 °C', 'us')).toBe('Bag ved 400 °F');
    expect(convertTemperatures('Bake at 350°F', 'original')).toBe('Bake at 350°F');
  });
});

describe('nutrition estimate', () => {
  it('sums known ingredients and reports unknown ones', () => {
    const ings = parseIngredientLines(['200 g flour', '2 eggs', '1 tbsp olive oil', '1 pinch salt', '1 dragon fruit']);
    const n = estimateNutrition(ings, 2);
    // flour 728 + eggs 143 + oil ~119
    expect(n.total.kcal).toBeGreaterThan(950);
    expect(n.total.kcal).toBeLessThan(1030);
    expect(n.perServing.kcal).toBe(Math.round(n.total.kcal / 2));
    expect(n.missing).toEqual(['dragon fruit']);
  });
  it('ignores seasoning without amounts', () => {
    const n = estimateNutrition(parseIngredientLines(['Salt to taste', '100 g rice']), 1);
    expect(n.missing).toEqual([]);
    expect(n.total.kcal).toBe(360);
  });
});

describe('timers', () => {
  it('finds durations in three languages', () => {
    expect(findTimers('Simmer for 10-12 minutes, then rest 1 hour.').map((t) => t.seconds)).toEqual([600, 3600]);
    expect(findTimers('Bag i 25 min. ved 200 grader').map((t) => t.seconds)).toEqual([1500]);
    expect(findTimers('Kepkite 45 minutes, palikite 1 val.').map((t) => t.seconds)).toEqual([2700, 3600]);
    expect(findTimers('Add 2 tsk salt')).toEqual([]);
  });
  it('formats clocks', () => {
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('parseRecipeText', () => {
  it('parses a headed recipe', () => {
    const d = parseRecipeText(`Banana pancakes
Fluffy and quick.
Serves 4

Ingredients:
- 2 bananas
- 2 eggs
- 1 cup flour

Method
1. Mash the bananas and whisk in the eggs.
2. Fold in the flour and fry until golden.

#pancakes #breakfast`);
    expect(d.title).toBe('Banana pancakes');
    expect(d.servings).toBe(4);
    expect(d.ingredients).toEqual(['2 bananas', '2 eggs', '1 cup flour']);
    expect(d.steps).toEqual(['Mash the bananas and whisk in the eggs.', 'Fold in the flour and fry until golden.']);
    expect(d.description).toBe('Fluffy and quick.');
  });
  it('parses Danish and Lithuanian headings', () => {
    const da = parseRecipeText('Frikadeller\nIngredienser\n500 g hakket svinekød\n1 løg\nFremgangsmåde\nRør farsen sammen.\nSteg i smør.');
    expect(da.ingredients).toHaveLength(2);
    expect(da.steps).toHaveLength(2);
    const lt = parseRecipeText('Šaltibarščiai\nIngredientai:\n1 l kefyro\n2 agurkai\nGaminimas:\nViską sumaišykite.');
    expect(lt.title).toBe('Šaltibarščiai');
    expect(lt.ingredients).toEqual(['1 l kefyro', '2 agurkai']);
    expect(lt.steps).toEqual(['Viską sumaišykite.']);
  });
  it('parses a caption without headings', () => {
    const d = parseRecipeText(`Creamy tomato pasta 🍝
200 g pasta
1 can chopped tomatoes
100 ml cream
Boil the pasta until al dente while the sauce simmers.
Stir everything together and serve with basil.`);
    expect(d.title).toBe('Creamy tomato pasta 🍝');
    expect(d.ingredients).toHaveLength(3);
    expect(d.steps).toHaveLength(2);
  });
});

describe('importer', () => {
  const html = `<html lang="en"><head><meta property="og:site_name" content="Test Kitchen">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"x"},
{"@type":["Recipe"],"name":"Lemon &amp; Herb Chicken","description":"<p>Bright and easy.</p>","image":{"url":"/img/chicken.jpg"},
"recipeYield":["4","4 servings"],"prepTime":"PT15M","totalTime":"PT1H","recipeCategory":"Dinner","keywords":"chicken, lemon",
"recipeIngredient":["4 chicken thighs","1 lemon","2 tbsp olive oil"],
"recipeInstructions":[{"@type":"HowToSection","name":"Cook","itemListElement":[{"@type":"HowToStep","text":"Season the chicken."},{"@type":"HowToStep","text":"Roast at 400°F for 45 minutes."}]}],
"nutrition":{"@type":"NutritionInformation","calories":"420 kcal","proteinContent":"32 g"}}]}</script></head><body></body></html>`;
  it('extracts a schema.org recipe', () => {
    const d = extractJsonLdRecipe(html, 'https://example.com/recipes/chicken')!;
    expect(d.title).toBe('Lemon & Herb Chicken');
    expect(d.description).toBe('Bright and easy.');
    expect(d.image).toBe('https://example.com/img/chicken.jpg');
    expect(d.servings).toBe(4);
    expect(d.prepMin).toBe(15);
    expect(d.cookMin).toBe(45);
    expect(d.ingredients).toHaveLength(3);
    expect(d.steps).toEqual(['Season the chicken.', 'Roast at 400°F for 45 minutes.']);
    expect(d.mealTypes).toEqual(['dinner']);
    expect(d.nutrition).toMatchObject({ kcal: 420, protein: 32 });
    expect(d.sourceName).toBe('Test Kitchen');
  });
  it('falls back to a social caption', () => {
    const page = `<html><head><meta property="og:title" content="Cook on Instagram">
<meta property="og:description" content="1,234 likes, 56 comments - cook on May 1, 2026: &quot;Garlic noodles&#10;200 g noodles&#10;4 cloves garlic&#10;2 tbsp soy sauce&#10;Boil the noodles then toss everything in a hot pan.&quot;"></head></html>`;
    const r = importFromHtml(page, 'https://www.instagram.com/reel/abc/');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.via).toBe('caption');
      expect(r.draft.title).toBe('Garlic noodles');
      expect(r.draft.ingredients).toHaveLength(3);
    }
  });
  it('reports pages without a recipe', () => {
    const r = importFromHtml('<html><head><title>Hello</title></head><body>Nothing here</body></html>', 'https://example.com');
    expect(r.ok).toBe(false);
  });
  it('has small helpers that behave', () => {
    expect(isoDurationToMinutes('PT1H30M')).toBe(90);
    expect(isSocialUrl('https://www.tiktok.com/@a/video/1')).toBe(true);
    expect(isSocialUrl('https://www.valdemarsro.dk/frikadeller/')).toBe(false);
    expect(firstUrl('Look at this https://vm.tiktok.com/abc/ wow')).toBe('https://vm.tiktok.com/abc/');
    expect(unwrapSocialCaption('5 likes - a on May 1: "Hello there"')).toBe('Hello there');
  });
});

describe('scaling polish', () => {
  const o = { system: 'original' as const, useDl: false, lang: 'en' as const };
  it('rolls metric amounts over when scaled', () => {
    expect(displayIngredient(parseIngredient('500 g minced pork'), { ...o, scale: 2 })).toBe('1 kg minced pork');
    expect(displayIngredient(parseIngredient('600 ml stock'), { ...o, scale: 2 })).toBe('1.2 l stock');
  });
  it('keeps English nouns in agreement with the amount', () => {
    expect(displayIngredient(parseIngredient('1 onion'), { ...o, scale: 2 })).toBe('2 onions');
    expect(displayIngredient(parseIngredient('1 large egg, beaten'), { ...o, scale: 3 })).toBe('3 large eggs, beaten');
    expect(displayIngredient(parseIngredient('1 tomato'), { ...o, scale: 2 })).toBe('2 tomatoes');
    expect(displayIngredient(parseIngredient('1 bay leaf'), { ...o, scale: 2 })).toBe('2 bay leaves');
    expect(displayIngredient(parseIngredient('2 eggs'), { ...o, scale: 0.5 })).toBe('1 egg');
    expect(displayIngredient(parseIngredient('4 eggs'), { ...o, scale: 0.5 })).toBe('2 eggs');
  });
  it('leaves other languages exactly as written', () => {
    expect(displayIngredient(parseIngredient('1 løg'), { ...o, lang: 'da', contentLang: 'da', scale: 2 })).toBe('2 løg');
    expect(displayIngredient(parseIngredient('1 svogūnas'), { ...o, lang: 'en', contentLang: 'lt', scale: 2 })).toBe('2 svogūnas');
  });
  it('uses measuring-set fractions for cups', () => {
    expect(formatQty(200 / 240, 'cup', 'en')).toBe('⅞');
  });
});

describe('store offers', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  it('searches under the Danish name of an ingredient', () => {
    expect(offerQuery('minced beef')).toBe('hakket oksekød');
    expect(offerQuery('500 g pieno'.replace('500 g ', ''))).toBe('mælk');
    expect(offerQuery('hakket oksekød')).toBe('hakket oksekød');
    expect(offerQuery('piskefløde')).toBe('piskefløde');
    expect(offerQuery('dishwasher tablets')).toBe('dishwasher tablets');
  });
  it('reads real API offers, with a per-kilo price', () => {
    const offers = parseOffers(fixture);
    expect(offers.length).toBe(12);
    const first = offers[0];
    expect(first.store).toBe('Lidl');
    expect(first.price).toBe(29.95);
    expect(first.unitPrice).toEqual({ value: 74.88, unit: 'kg' });
  });
  it('keeps one relevant, current offer per store, cheapest per kilo first', () => {
    const picked = pickOffers(parseOffers(fixture), 'minced beef', 'hakket oksekød', now);
    expect(picked.length).toBeGreaterThan(2);
    expect(new Set(picked.map((o) => o.store)).size).toBe(picked.length);
    const prices = picked.map((o) => o.unitPrice?.value ?? Infinity);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
  it('drops expired offers and near-misses', () => {
    const offers = parseOffers([
      { id: 'a', heading: 'Løgismose økologisk kefir', pricing: { price: 18, currency: 'DKK' }, branding: { name: 'Netto' }, run_till: '2026-12-01T00:00:00+0000' },
      { id: 'b', heading: 'Arla letmælk', pricing: { price: 9, currency: 'DKK' }, branding: { name: 'Netto' }, run_till: '2026-11-01T00:00:00+0000' },
      { id: 'c', heading: 'Arla sødmælk', pricing: { price: 11, pre_price: 14, currency: 'DKK' }, branding: { name: 'føtex' }, run_till: '2026-12-01T00:00:00+0000' },
    ]);
    const picked = pickOffers(offers, 'milk', 'mælk', now);
    expect(picked.map((o) => o.id)).toEqual(['c']);
    expect(picked[0].prePrice).toBe(14);
  });
  it('ranks stores by how much of the list they cover', () => {
    const o = (store: string) => ({ id: store, heading: 'x', price: 1, currency: 'DKK', store });
    expect(storeCoverage({ a: [o('Netto'), o('Lidl')], b: [o('Netto')], c: [] })[0]).toEqual({ store: 'Netto', items: 2 });
    expect(formatPrice(39, 'DKK')).toBe('39 kr.');
    expect(formatPrice(29.95, 'DKK')).toBe('29,95 kr.');
  });
});

describe('foods named in a step', () => {
  it('lists them in order and keeps only the most specific name', () => {
    expect(foodsMentioned('Boil the potatoes, then slice the cucumber and add olive oil.')).toEqual(['potato', 'cucumber', 'oliveoil']);
    expect(foodsMentioned('Kog kartoflerne i saltet vand, og skær agurkerne i tern.')).toEqual(['potato', 'water', 'cucumber']);
    expect(foodsMentioned('Bulves virkite pasūdytame vandenyje.')).toEqual(['potato', 'water']);
    expect(foodsMentioned('Stir well and serve.')).toEqual([]);
  });
});

describe('social posts', () => {
  it('reads the whole Instagram caption from the embed page', () => {
    const html = `<div class="EmbeddedMedia"><img class="EmbeddedMediaImage" alt="x" src="https://cdn.example/p.jpg?a=1&amp;b=2"/></div>
<div class="Caption"><a class="CaptionUsername" href="https://www.instagram.com/cook/" target="_blank">cook</a><br /><br />Garlic noodles<br />200 g noodles<br />4 cloves garlic<br />2 tbsp soy sauce<br /><br />Boil the noodles, then toss with <a href="/x/">&#064;someone</a>&#39;s sauce.<div class="CaptionComments"><a class="CaptionCommentsExpand">View all 29 comments</a></div></div>`;
    const post = parseInstagramEmbed(html)!;
    expect(post.author).toBe('cook');
    expect(post.image).toBe('https://cdn.example/p.jpg?a=1&b=2');
    expect(post.text.split('\n')).toEqual(['Garlic noodles', '200 g noodles', '4 cloves garlic', '2 tbsp soy sauce', "Boil the noodles, then toss with @someone's sauce."]);
    expect(parseRecipeText(post.text).ingredients).toHaveLength(3);
  });
  it('reads the full YouTube description', () => {
    const html = `<meta property="og:title" content="Best pancakes"><script>var x = {"shortDescription":"Ingredients:\\n2 eggs\\n1 cup flour\\n\\nMethod:\\nMix \\"gently\\" and fry.","ownerChannelName":"Home Cook"};</script>`;
    const post = parseYouTubeWatch(html)!;
    expect(post.title).toBe('Best pancakes');
    expect(post.author).toBe('Home Cook');
    expect(post.text).toContain('Mix "gently" and fry.');
    expect(parseRecipeText(post.text).ingredients).toEqual(['2 eggs', '1 cup flour']);
  });
  it('reads a TikTok caption and recognises post links', () => {
    expect(parseTikTokOEmbed({ title: 'Quick ramen #food', author_name: 'chef' })).toMatchObject({ text: 'Quick ramen #food', author: 'chef' });
    expect(parseTikTokOEmbed({ html: '<iframe>' })).toBeUndefined();
    expect(instagramShortcode('https://www.instagram.com/reel/CUbHfhpswxt/?igsh=abc')).toBe('CUbHfhpswxt');
    expect(instagramShortcode('https://www.instagram.com/someone/p/CUbHfhpswxt/')).toBe('CUbHfhpswxt');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=x')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ');
  });
});
