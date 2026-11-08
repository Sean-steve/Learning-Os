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

test('knowledge source can be added, filtered, and revisited', async ({ page }) => {
  await page.goto('/#library');
  await page.getByRole('button', { name: /Add learning source/ }).click();
  await page.getByPlaceholder('e.g. Dream awareness workshop').fill('Sample learning source');
  await page.getByPlaceholder('https://...').fill('https://example.org/lesson');
  await page.getByRole('button', { name: /Save source/ }).click();
  await expect(page.getByText('Sample learning source')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Sample learning source')).toBeVisible();
});

test('calendar session can be created and checked off', async ({ page }) => {
  await page.goto('/#calendar');
  await page.getByRole('button', { name: /Add study session/ }).click();
  await page.getByPlaceholder('e.g. Listen: lucid dream foundations').fill('Practice listening session');
  await page.getByRole('button', { name: /Add session/ }).click();
  await expect(page.getByText('Practice listening session')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Practice listening session')).toBeVisible();
});

test('audio queue changes track and records completion', async ({ page }) => {
  await page.goto('/#audio');
  await expect(page.locator('.audio-hero h2')).toContainText('remembering dreams');
  await page.getByRole('button', { name: 'Next track' }).click();
  await expect(page.locator('.audio-hero h2')).toContainText('Mindfulness');
  await page.getByRole('button', { name: 'Mark lesson complete' }).first().click();
  await page.reload();
  await expect(page.locator('.audio-hero h2')).toContainText('remembering dreams');
});

test('reader opens a local PDF without uploading it', async ({ page }) => {
  await page.goto('/#reader');
  const buffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  await page.locator('input[type="file"]').setInputFiles({ name: 'local-preview.pdf', mimeType: 'application/pdf', buffer });
  await expect(page.getByText('local-preview.pdf')).toBeVisible();
  await expect(page.locator('iframe[title="Locally opened PDF"]')).toBeVisible();
});

test('focus session can be started and paused', async ({ page }) => {
  await page.goto('/#focus');
  await page.getByRole('button', { name: /Start focusing/ }).click();
  await expect(page.getByRole('button', { name: /Pause session/ })).toBeVisible();
  await page.getByRole('button', { name: /Pause session/ }).click();
  await expect(page.getByRole('button', { name: /Start focusing/ })).toBeVisible();
});

test('lesson notes persist between page reloads', async ({ page }) => {
  await page.goto('/#lesson');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByPlaceholder('What stood out? What will you practice?').fill('Practice recall before reading.');
  await page.reload();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.getByPlaceholder('What stood out? What will you practice?')).toHaveValue('Practice recall before reading.');
});

test('assessment can be answered and scored', async ({ page }) => {
  await page.goto('/#assessments');
  await page.getByRole('button', { name: /Remain still and reconstruct the dream/ }).click();
  await page.getByRole('button', { name: /Consistently recorded dream recall/ }).click();
  await page.getByRole('button', { name: /To separate claims and provenance from evidence/ }).click();
  await page.getByRole('button', { name: /Submit assessment/ }).click();
  await expect(page.getByText('3 / 3 correct')).toBeVisible();
});
