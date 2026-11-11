/**
 * Browser walkthrough of the main flows. Start the app first (`npm run web`), then `npm run test:e2e`.
 * Needs a Chromium for Playwright: `npx playwright install chromium`, or point PW_CHROMIUM at one.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

let failed = 0;
const text = () => page.locator('body').innerText();
const expectText = async (needle) => {
  // Section labels are upper-cased by styling, so compare without regard to case.
  if (!(await text()).toLowerCase().includes(needle.toLowerCase())) throw new Error(`expected to see "${needle}"`);
};
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`ok    ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}: ${String(e).split('\n')[0]}`);
  }
};
const wait = (ms = 700) => page.waitForTimeout(ms);
const home = async () => {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 180_000 });
  await wait(1200);
};

await home();
await step('first run shows the starter recipes', () => expectText('Danish meatballs (frikadeller)'));

await step('scaling doubles amounts and fixes plurals', async () => {
  await page.getByRole('button', { name: 'Danish meatballs (frikadeller)' }).click();
  await wait(1200);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'More servings' }).click();
  await wait(300);
  await expectText('1 kg minced pork');
  await expectText('2 onions');
});

await step('US units convert metric amounts', async () => {
  await page.getByRole('tab', { name: 'US cups' }).click();
  await wait(300);
  await expectText('2 ¼ lb minced pork');
  await page.getByRole('tab', { name: 'As written' }).click();
});

await step('recipe goes into the cart, pantry staples left out', async () => {
  await page.getByTestId('to-groceries').click();
  await wait();
  await expectText('In your pantry');
  await page.getByTestId('grocery-add-confirm').click();
  await wait();
});

await step('cook mode steps through and offers a timer', async () => {
  await page.getByTestId('start-cooking').click();
  await wait(1000);
  await expectText('Step 1 of 4');
  await page.getByTestId('cook-next').click();
  await wait(300);
  await page.getByRole('button', { name: /Timer · 15 minutes/ }).click();
  await wait(1200);
  await expectText('14:5');
  for (let i = 0; i < 3; i++) await page.getByTestId('cook-next').click();
  await wait(400);
  await page.getByRole('button', { name: 'Done' }).click();
  await wait();
});

await step('cart lists the recipe and merges typed items', async () => {
  await home();
  await page.getByRole('tab', { name: /Cart/ }).click();
  await wait();
  await expectText('Recipes in your cart');
  await page.getByPlaceholder(/Add an item/).fill('1 onion');
  await page.getByTestId('grocery-add').click();
  await wait(400);
  await expectText('3 onion');
});

await step('removing the recipe from the cart removes its ingredients', async () => {
  await page.getByRole('button', { name: /^Remove Danish meatballs/ }).click();
  await wait();
  if ((await text()).includes('minced pork')) throw new Error('ingredients still listed');
});

await step('meal plan takes a recipe', async () => {
  await page.getByRole('tab', { name: /Plan/ }).click();
  await wait();
  await page.getByRole('button', { name: /Add a meal on/ }).first().click();
  await wait();
  await page.getByRole('button', { name: 'One-pan creamy tomato pasta' }).last().click();
  await wait();
  await expectText('One-pan creamy tomato pasta');
});

await step('pasted text becomes a recipe with converted units', async () => {
  await page.goto(`${BASE}/import?mode=text`, { waitUntil: 'networkidle' });
  await wait(1000);
  await page
    .getByPlaceholder(/Paste the whole recipe/)
    .fill('Banana pancakes\nServes 4\n\nIngredients:\n- 2 bananas\n- 1 cup flour\n\nMethod\n1. Mash the bananas.\n2. Fry at 350°F for 3 minutes per side.');
  await page.getByTestId('import-text').click();
  await wait(1200);
  await page.getByTestId('save-recipe').click();
  await wait(1200);
  await page.getByRole('tab', { name: 'Metric' }).click();
  await wait(300);
  await expectText('125 g flour');
  await expectText('175 °C');
});

await step('language switches to Lithuanian and Danish', async () => {
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await wait(1000);
  await page.getByRole('tab', { name: 'Lietuvių' }).click();
  await wait(400);
  await expectText('Nustatymai');
  await page.getByRole('tab', { name: 'Dansk' }).click();
  await wait(400);
  await expectText('Indstillinger');
});

await step('everything is still there after a reload', async () => {
  await home();
  await expectText('Banana pancakes');
  await expectText('Opskrifter');
});

await step('no uncaught errors in the page', () => {
  if (errors.length) throw new Error(errors[0]);
});

await browser.close();
if (failed) {
  console.log(`\n${failed} step(s) failed`);
  process.exit(1);
}
console.log('\nAll steps passed');
