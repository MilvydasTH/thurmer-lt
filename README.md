# Skanu

A recipe keeper for iOS, Android and the web: save recipes from links, text or photos, organise
them into cookbooks, plan the week, build the grocery list and cook step by step.

The interface is in **English, Danish and Lithuanian**. Recipes stay in the language they were
written in. It is free to use: no subscription, no trial, no account.

Built with Expo (React Native) and Expo Router. One codebase for all three platforms.

## What it does

| Area | What you get |
| --- | --- |
| Save recipes | From a link (recipe sites publish structured data that is read directly), from pasted text, from a photo, or typed by hand. Imports open in the editor so you can check them before saving. |
| Social links | Instagram, TikTok, YouTube, Pinterest and Facebook links are read from the post's caption. See [limits](#known-limits). |
| Cookbooks | Your own collections, plus favourites, meal types and tags. Search covers titles, tags and ingredients. |
| Servings and units | Scale any recipe. Switch between the recipe as written, metric (grams, ml or dl) and US cups. Cups of flour, sugar and similar become grams; oven temperatures convert too. |
| Shopping cart | Add a recipe to the cart with one button, or a whole planned week. The cart shows which recipes are in it and everything you need to buy. Duplicates merge ("1 onion" + "2 onions"). View by aisle or by recipe. Pantry staples you always have are left out. Removing a recipe removes its ingredients. |
| Store offers (Denmark) | For each item still to buy, the cart shows the cheapest current leaflet offer per store, compared per kilo or litre, and which stores cover most of the list. Ingredients are looked up under their Danish name, so English and Lithuanian recipes work too. Needs a Tjek API key, see below. |
| Meal plan | Week view with breakfast, lunch, dinner and snack, and one button to send the week to the grocery list. |
| Nutrition | Calories, protein, carbs and fat per serving, estimated from a built-in food table that understands ingredient names in all three languages. It says which ingredients it could not count. |
| Cook mode | One step at a time in large type, screen kept awake, timers picked out of the step text. |
| Share and backup | Share a recipe or the grocery list as text. Export and import the whole library as a file. |

## Run it

```bash
npm install
npm run web        # opens the app in a browser
npm start          # then scan the QR code with Expo Go on a phone
```

Checks:

```bash
npm test           # unit tests for parsing, scaling, conversion, nutrition and import
npm run typecheck
```

### On a phone

`npm start` plus the Expo Go app is the quickest look. Two things need a real build instead of
Expo Go: sharing a link *into* Skanu from another app, and the app icon. For that:

```bash
npx eas-cli@latest build --profile development --platform ios   # or android
```

`eas.json` has `development`, `preview` and `production` profiles. Publishing to the App Store
needs an Apple Developer account; the bundle identifier is set to `app.skanu.recipes` in
`app.json` and can be changed there.

## The server part

Most of the app runs entirely on the device. Three small server routes exist for the things a
phone or browser cannot do alone:

- `POST /api/import` fetches a page for link import (browsers are not allowed to read other
  sites; phones fetch recipe sites directly and only ask the server for social links).
- `POST /api/ai` reads recipes from photos and unstructured text, and translates recipes.
- `POST /api/offers` looks up current Danish store offers for the items in the cart.
- `GET /api/status` tells the app whether AI and offers are available.

They are Expo Router API routes in `src/app/api`. In development they run inside `npm start`.
To deploy the web app and the routes together:

```bash
npm run build:web
npx eas-cli@latest deploy      # EAS Hosting; any Node host that runs `expo serve` also works
```

Then set `EXPO_PUBLIC_API_URL` to that deployment's address when building the phone apps.

### Store offers

Offers come from [Tjek](https://tjek.com) (the service behind eTilbudsavis), which carries the
leaflets of Netto, REMA 1000, Lidl, føtex, Bilka, Coop and others. Create an app in the Tjek CMS
to get an API key and set it as `TJEK_API_KEY` on the server. The key stays on the server; the app
calls `POST /api/offers`. Without a key the cart says offers are not set up. Check Tjek's terms
for your use before publishing the app.

minetilbud.dk was the first choice but cannot be connected: its website publishes whole leaflets
only, and the product-level offers live in its mobile app's private service. A partnership with
its operator, FK Distribution, would be the way in.

### AI features

Set `ANTHROPIC_API_KEY` on the server (see `.env.example`). Without it the app still works; the
"read with AI", photo reading and translation controls simply do not appear. The key is only
read by the server routes and is never part of the app bundle. The routes have size limits but
no login, so put them behind your host's rate limiting before sharing the app widely.

## Known limits

- **Recipes that are only spoken in a video cannot be imported.** Social imports read the caption.
  Instagram in particular often refuses to hand captions to servers; when that happens the app
  says so and you can paste the caption as text.
- **No cloud sync or accounts.** The library lives on the device. Moving between devices is done
  with the backup file. Sync needs a hosted database and sign-in, which is a product decision
  (which provider, what it costs) rather than something to guess at.
- **Ordering groceries opens the store's search, item by item** (Barbora and Rimi in Lithuania,
  nemlig.com in Denmark). These stores offer no way for an app to fill a basket.
- **Nutrition is an estimate** from about 110 common foods. Recipes that state their own
  nutrition keep the source's figures.
- **Timers run while cook mode is open.** They do not notify you after the app is closed.
- Singular/plural fixes when scaling ("1 onion" → "2 onions") are done for English only; Danish
  and Lithuanian ingredient lines keep their wording and only the number changes.

## Project layout

```
src/app          screens and API routes (file-based routing)
src/components   shared UI
src/lib          parsing, conversion, nutrition, import: plain TypeScript, unit-tested
src/data         food table and starter recipes
src/i18n         en, da, lt
src/server       server-only code (page fetching, AI)
src/store        app state, saved on the device
tests            unit tests
```

Adding a language: copy `src/i18n/en.ts`, translate it, register it in `src/i18n/index.ts`, and
add its ingredient names to `src/data/foods.ts` and unit names to `src/lib/units.ts`.
