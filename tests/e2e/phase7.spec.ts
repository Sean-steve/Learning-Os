import {test,expect} from '@playwright/test';

const email=()=>`phase7-${Date.now()}-${Math.floor(Math.random()*100000)}@example.test`;
const password='correct horse study habit 2026';
async function register(page:any,username:string){
  await page.goto('/#account');
  await page.getByRole('button',{name:'Create account'}).click();
  await page.getByPlaceholder('your@email.com').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button',{name:'Create private account'}).click();
  await expect(page.getByRole('heading',{name:'Choose where to begin'})).toBeVisible();
  await page.getByRole('button',{name:/Use cloud records on this device/}).click();
  await expect(page.getByRole('button',{name:/Learning records: Connected/})).toBeVisible({timeout:30_000});
}
async function login(page:any,username:string){
  await page.goto('/#account');
  await page.getByPlaceholder('your@email.com').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button',{name:'Sign in to PostgreSQL'}).click();
  await expect(page.getByRole('heading',{name:'Choose where to begin'})).toBeVisible();
  await page.getByRole('button',{name:/Use cloud records on this device/}).click();
  await expect(page.getByRole('button',{name:/Learning records: Connected/})).toBeVisible({timeout:30_000});
}
test('two independent browser contexts reconcile journal changes and remote sessions are revocable',async({page,browser})=>{
  test.setTimeout(90_000);
  const username=email();
  await register(page,username);
  const second=await browser.newContext();
  const page2=await second.newPage();
  try{
    await login(page2,username);
    await page.goto('/#journal');
    await page.getByPlaceholder('e.g. A vivid fragment from last night').fill('Cross device evidence');
    await page.getByPlaceholder('Describe what happened, what you remembered, what you felt, or what you practiced...').fill('Verified on the second browser after a manual remote refresh.');
    await page.getByRole('button',{name:/Save journal entry/}).click();
    await expect.poll(async()=>page.evaluate(async()=>{
      const response=await fetch('/api/v1/records',{credentials:'same-origin'});
      const body=await response.json();
      return Boolean(body.records?.find((r:any)=>r.key==='los.journal')?.data?.some((x:any)=>x.title==='Cross device evidence'));
    }),{timeout:25000}).toBe(true);
    await page2.goto('/#account');
    await page2.getByRole('button',{name:/Check for changes on other devices/}).click();
    await expect(page2.getByRole('button',{name:/Learning records: Connected/})).toBeVisible();
    await page2.goto('/#journal');
    await expect(page2.locator('.journal-history').getByText('Cross device evidence')).toBeVisible();
    await page.goto('/#account');
    await page.getByRole('button',{name:'Review active sessions'}).click();
    await expect(page.getByText('Active sessions: 2')).toBeVisible();
    await page.getByRole('button',{name:'Sign out other devices'}).click();
    await expect(page.getByText('Active sessions: 1')).toBeVisible();
    const denied=await page2.evaluate(async()=>{const response=await fetch('/api/v1/records',{credentials:'same-origin'});return response.status});
    expect(denied).toBe(401);
  }finally{await second.close();}
});
