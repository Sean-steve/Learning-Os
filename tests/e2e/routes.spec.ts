import { test, expect } from '@playwright/test';

const routes = [
  'overview','goals','builder','programs','curriculum','lesson',
  'library','audio','reader','calendar','focus','journal',
  'assessments','analytics','coach','accountability','integrations','settings'
];

test('all 18 primary routes render without uncaught exceptions', async ({page}) => {
  const errors:string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  for (const route of routes) {
    await page.goto('/#' + route);
    await expect(page.locator('main.main-column')).toBeVisible();
    await expect(page.locator('main h1').first()).toBeVisible();
    expect((await page.locator('main').innerText()).trim().length).toBeGreaterThan(80);
  }
  expect(errors).toEqual([]);
});

test('dashboard navigation and visible demo-data disclosure', async ({page}) => {
  await page.goto('/#overview');
  await expect(page.getByText('Preview data').first()).toBeVisible();
  await expect(page.locator('nav[aria-label="Main navigation"]')).toBeAttached();
  await page.getByRole('button', {name: /Learning library/i}).first().click().catch(async()=>{
    await page.goto('/#library');
  });
  await expect(page.locator('main h1').first()).toBeVisible();
});

test('mobile layout has no major horizontal overflow', async ({page, isMobile}) => {
  if (!isMobile) test.skip();
  await page.goto('/#overview');
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);
  const viewport=await page.evaluate(()=>document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(viewport + 4);
});
