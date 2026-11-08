import { test, expect } from '@playwright/test';

const answerFoundation=async(page:import('@playwright/test').Page)=>{
  await page.getByRole('button',{name:'Remain still and reconstruct the dream'}).click();
  await page.getByRole('button',{name:'Consistently recorded dream recall'}).click();
  await page.getByRole('button',{name:'To separate claims and provenance from evidence'}).click();
  await page.getByRole('button',{name:/Submit assessment/}).click();
};

test('Phase 5 knowledge check records actual answers with confidence and survives refresh', async ({page})=>{
  await page.goto('/#assessments');
  await expect(page.getByRole('heading',{name:'Assessments'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Submit assessment/})).toBeDisabled();
  await page.getByRole('combobox',{name:'Confidence rating'}).selectOption('5');
  await answerFoundation(page);
  await expect(page.getByText('3 / 3 correct')).toBeVisible();
  await expect(page.locator('.p5-result').getByText('confidence 5/5')).toBeVisible();
  await page.reload();
  await expect(page.locator('.p5-attempts')).toContainText('100%');
});

test('one passing attempt does not fabricate mastered skills',async ({page})=>{
  await page.goto('/#assessments');await answerFoundation(page);
  await page.goto('/#analytics');
  await expect(page.getByText('0 / 4')).toBeVisible();
  await expect(page.getByText('0 externally verified')).toBeVisible();
  await expect(page.getByText('Foundation check · Week 01').first()).toBeVisible();
});

test('different-day repeated passes unlock knowledge, never independent verification',async ({page})=>{
  await page.goto('/#overview');
  await page.evaluate(()=>{const a={id:'pass-1',bankId:'foundation-check',skillId:'foundations',at:'2026-11-06T11:00:00Z',answers:{f1:1,f2:2,f3:0},correct:3,total:3,percent:100,confidence:4};
    const b={...a,id:'pass-2',at:'2026-11-07T11:00:00Z'};
    localStorage.setItem('los.phase5.attempts',JSON.stringify([a,b]));
  });
  await page.goto('/#analytics');await page.reload();
  await expect(page.getByText('1 / 4')).toBeVisible();
  await expect(page.getByText('Repeated knowledge checks')).toBeVisible();
  await expect(page.getByText('0 externally verified')).toBeVisible();
});

test('self-reported practice note records provenance without being counted as independent proof',async ({page})=>{
  await page.goto('/#coach');
  await page.getByRole('textbox',{name:'Practice evidence details'}).fill('Practiced recalling a dream scene after waking and wrote down the steps I could remember.');
  await page.getByRole('button',{name:/Save evidence record/}).click();
  await page.goto('/#analytics');
  await expect(page.getByText('Practice records').first()).toBeVisible();
  await expect(page.locator('.p5-timeline')).toContainText('Self-reported practice');
  await expect(page.locator('.p5-timeline')).toContainText('Practiced recalling a dream scene');
  await expect(page.getByText('0 externally verified')).toBeVisible();
  await page.reload();
  await expect(page.locator('.p5-timeline')).toContainText('Practiced recalling a dream scene');
});

test('external observations stay labeled as unverified',async ({page})=>{
  await page.goto('/#coach');
  await page.getByRole('combobox',{name:'Evidence type'}).selectOption('external-claim');
  await page.getByRole('textbox',{name:'Practice evidence details'}).fill('A subjective event felt unusual; I have no independently verifiable evidence.');
  await page.getByRole('button',{name:/Save evidence record/}).click();
  await page.goto('/#analytics');
  await expect(page.locator('.p5-timeline')).toContainText('Unverified external claim');
  await expect(page.getByText('0 externally verified')).toBeVisible();
});

test('custom skills persist and do not inherit unrelated quiz results',async ({page})=>{
  await page.goto('/#coach');
  await page.getByRole('textbox',{name:'Custom skill name'}).fill('Conversational Swahili');
  await page.getByRole('textbox',{name:'Custom skill outcome'}).fill('Speak with a shopkeeper for five minutes and record what I understood');
  await page.getByRole('button',{name:/Add custom skill/}).click();
  await page.goto('/#analytics');
  await expect(page.getByRole('heading',{name:'Conversational Swahili'})).toBeVisible();
  await expect(page.getByText('0 / 5')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Conversational Swahili'})).toBeVisible();
});

test('coach shrinks learning activity when user reports poor rest',async ({page})=>{
  await page.goto('/#coach');
  await page.getByRole('slider',{name:'Sleep quality'}).focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading',{name:/Protect your rest/})).toBeVisible();
  await expect(page.locator('.p5-suggestion')).toContainText('10 minutes');
  await expect(page.locator('.p5-card').first()).toContainText('Rules-based · not live AI');
});

test('coach does not change schedule until explicit approval',async ({page})=>{
  await page.goto('/#coach');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('los.sessions')||'[]').length);
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('los.sessions')||'[]').length)).toBe(before);
  await page.getByRole('button',{name:/Approve & schedule next action/}).click();
  await expect(page.locator('.toast')).toContainText('You approved');
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('los.sessions')||'[]').length)).toBe(before+1);
});

test('attempts saved in another tab appear in analytics without full reload',async ({page,context})=>{
  await page.goto('/#analytics');const second=await context.newPage();
  await second.goto('/#assessments');await answerFoundation(second);
  await expect(page.locator('.p5-stat').nth(2)).toContainText('1');
  await second.close();
});
