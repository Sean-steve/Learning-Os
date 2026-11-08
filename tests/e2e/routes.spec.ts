import { test, expect } from '@playwright/test';

const routes = [
  'overview','goals','builder','programs','curriculum','lesson',
  'library','audio','reader','calendar','focus','journal',
  'assessments','analytics','coach','accountability','integrations','settings'
];

for(const route of routes) {
  test('route '+route+' renders without uncaught exceptions', async ({page}) => {
    const errors:string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/#' + route, {waitUntil:'domcontentloaded'});
    await expect(page.locator('main.main-column')).toBeVisible();
    await expect(page.locator('main h1').first()).toBeVisible();
    expect((await page.locator('main').innerText()).trim().length).toBeGreaterThan(80);
    expect(errors).toEqual([]);
  });
}

test('sidebar navigation and demo-data disclosure', async ({page}) => {
  await page.goto('/#overview', {waitUntil:'domcontentloaded'});
  await expect(page.getByText('Preview data').first()).toBeAttached();
  const nav=page.getByRole('navigation', {name:'Main navigation'});
  await expect(nav).toBeAttached();
  const isMobile=await page.evaluate(()=>window.innerWidth <= 740);
  if(isMobile) await page.getByRole('button', {name:'Open menu'}).click();
  await nav.getByRole('button', {name:'Knowledge library'}).click();
  await expect(page).toHaveURL(/#library$/);
});

test('mobile dashboard has no major horizontal overflow', async ({page, isMobile}) => {
  if (!isMobile) test.skip();
  await page.goto('/#overview', {waitUntil:'domcontentloaded'});
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);
  const viewport=await page.evaluate(()=>document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(viewport + 4);
});
