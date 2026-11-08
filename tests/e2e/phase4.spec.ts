import { test, expect } from '@playwright/test';

test('schedule dashboard renders four metrics and protected learning plan', async ({ page }) => {
  await page.goto('/#calendar');
  await expect(page.getByRole('heading',{name:'Smart learning schedule'})).toBeVisible();
  await expect(page.getByText('Past sessions missed')).toBeVisible();
  await expect(page.getByText('Protected sleep/quiet hours')).toHaveCount(0);
  await expect(page.getByText('Google Calendar & exports')).toBeVisible();
});

test('learning session can be added and survives reload', async ({ page }) => {
  await page.goto('/#calendar');
  await page.getByRole('button',{name:'Add study session'}).click();
  await page.getByPlaceholder('e.g. Listen: lucid dream foundations').fill('Evening audio practice');
  await page.getByRole('button',{name:'Add session'}).click();
  await expect(page.locator('.calendar-event').getByText('Evening audio practice')).toBeVisible();
  await page.reload();
  await expect(page.locator('.calendar-event').getByText('Evening audio practice')).toBeVisible();
});

test('quiet-hours conflict offers alternative requiring approval', async ({ page }) => {
  await page.goto('/#calendar');
  await page.getByRole('button',{name:'Add study session'}).click();
  await page.getByPlaceholder('e.g. Listen: lucid dream foundations').fill('Late night practice');
  await page.getByLabel('Session time').fill('23:10');
  await page.getByRole('button',{name:'Add session'}).click();
  await expect(page.getByRole('alert')).toContainText('sleep');
  await expect(page.getByRole('button',{name:'Apply suggested time'})).toBeVisible();
  await expect(page.locator('.calendar-event').getByText('Late night practice')).toHaveCount(0);
  await page.getByRole('button',{name:'Apply suggested time'}).click();
  await expect(page.locator('.calendar-event').getByText('Late night practice')).toBeVisible();
});

test('week navigation and daily limits are interactive', async ({ page }) => {
  await page.goto('/#calendar');
  await page.getByRole('button',{name:'Adjust pace'}).click();
  await expect(page.getByRole('combobox',{name:'Daily study limit'})).toBeVisible();
  await page.getByRole('combobox',{name:'Daily study limit'}).selectOption('45');
  await page.reload();
  await page.getByRole('button',{name:'Adjust pace'}).click();
  await expect(page.getByRole('combobox',{name:'Daily study limit'})).toHaveValue('45');
  await page.getByRole('button',{name:'Next week'}).click();
  await expect(page.getByRole('heading',{name:'Upcoming learning blocks'})).toBeVisible();
});

test('calendar file downloads without OAuth', async ({ page }) => {
  await page.goto('/#calendar');
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Download calendar/}).click()]);
  expect(download.suggestedFilename()).toBe('learning-os-schedule.ics');
});

test('individual Google event can be opened without sharing credentials', async ({ page }) => {
  await page.goto('/#calendar');
  const link=page.getByRole('link',{name:/Add .* to Google Calendar/}).first();
  await expect(link).toHaveAttribute('target','_blank');
  expect(await link.getAttribute('href')).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
});

test('accountability follows completed study sessions without harsh catchup', async ({ page }) => {
  await page.goto('/#accountability');
  await expect(page.getByRole('heading',{name:'Your learning accountability'})).toBeVisible();
  await expect(page.getByText('Adaptive learning guidance')).toBeVisible();
  await page.getByRole('button',{name:'Adjust pace'}).click();
  await page.getByRole('combobox',{name:'Sleep quality this week'}).selectOption('3');
  await expect(page.locator('.p4-advice')).toContainText('Protect sleep');
});

test('same-browser tabs see newly saved learning sessions', async ({ page, context }) => {
  const page2=await context.newPage();
  await page.goto('/#calendar'); await page2.goto('/#calendar');
  await page.getByRole('button',{name:'Add study session'}).click();
  await page.getByPlaceholder('e.g. Listen: lucid dream foundations').fill('Cross-tab learning session');
  await page.getByRole('button',{name:'Add session'}).click();
  await expect(page.locator('.calendar-event').getByText('Cross-tab learning session')).toBeVisible();
  await expect(page2.locator('.calendar-event').getByText('Cross-tab learning session')).toBeVisible();
  await page2.close();
});
