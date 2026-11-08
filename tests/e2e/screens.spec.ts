import { test, expect } from '@playwright/test';

// Explicitly enumerate every Phase 1 route so coverage regressions cannot hide.
const routes = [
  'overview', 'goals', 'builder', 'programs', 'curriculum', 'lesson',
  'library', 'audio', 'reader', 'calendar', 'focus', 'journal',
  'assessments', 'analytics', 'coach', 'accountability', 'integrations', 'settings',
] as const;

for (const route of routes) {
  test(`${route}: screen renders without a client exception or page-width overflow`, async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`/#${route}`);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.locator('footer')).toContainText('browser-local', { ignoreCase: true });
    await expect(page).toHaveURL(new RegExp(`#${route}$`));
    await expect.poll(() => pageErrors).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 4);
    expect(overflow, `unexpected horizontal page overflow on ${route}`).toBe(false);
    await testInfo.attach(`${route}-${testInfo.project.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
}

test('navigation, browser history, and search palette', async ({ page }, testInfo) => {
  await page.goto('/#overview');
  if (testInfo.project.name.includes('mobile')) {
    await page.getByRole('button', { name: 'Open menu' }).click();
  }
  await page.getByRole('button', { name: 'My goals' }).click();
  await expect(page).toHaveURL(/#goals$/);
  await page.goBack();
  await expect(page).toHaveURL(/#overview$/);
  await page.getByRole('button', { name: 'Search your workspace' }).click();
  await expect(page.getByPlaceholder('Search pages and learning resources...')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByPlaceholder('Search pages and learning resources...')).toBeHidden();
});

test('journal entries survive a refresh', async ({ page }) => {
  await page.goto('/#journal');
  await page.getByPlaceholder('e.g. A vivid fragment from last night').fill('Night observation');
  await page.getByPlaceholder('Describe what happened, what you remembered, what you felt, or what you practiced...').fill('Recorded a remembered dream fragment.');
  await page.getByRole('button', { name: /Save journal entry/i }).click();
  await expect(page.getByText('Night observation')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Night observation')).toBeVisible();
});

test('goal builder saves a new goal in local storage', async ({ page }) => {
  await page.goto('/#builder');
  await page.getByPlaceholder('e.g. Become proficient in lucid dreaming').fill('Learn conversational Swahili');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: /Save learning goal/i }).click();
  await expect(page).toHaveURL(/#goals$/);
  await expect(page.getByText('Learn conversational Swahili')).toBeVisible();
});
