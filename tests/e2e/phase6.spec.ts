import {test,expect} from '@playwright/test';
const stamp=()=>`${Date.now()}-${Math.round(Math.random()*1e8)}@example.test`;
const password='correct horse study habit 2026';
async function signup(page:any,email:string){
 await page.goto('/#account');
 await page.getByRole('button',{name:'Create account'}).click();
 await page.getByPlaceholder('your@email.com').fill(email);
 await page.locator('input[type="password"]').fill(password);
 await page.getByRole('button',{name:'Create private account'}).click();
 await expect(page.getByRole('heading',{name:'Choose where to begin'})).toBeVisible();
}
test('account registration, explicit import and durable journal record',async({page})=>{
 const email=stamp();await signup(page,email);
 await expect(page.getByText(/No upload has occurred/)).toBeVisible();
 await page.locator('.cloud-check input').check();
 await page.getByRole('button',{name:/Import this browser/}).click();
 await expect(page.getByText('Signed in to local PostgreSQL')).toBeVisible();
 await page.goto('/#journal');
 await page.getByPlaceholder('e.g. A vivid fragment from last night').fill('Durable journal for '+email.slice(0,8));
 await page.getByPlaceholder('Describe what happened, what you remembered, what you felt, or what you practiced...').fill('Uploaded through private, authenticated PostgreSQL sync.');
 await page.getByRole('button',{name:/Save journal entry/}).click();
 await expect.poll(async()=>page.evaluate(async()=>{
   const r=await fetch('/api/v1/records',{credentials:'same-origin'});
   const j=await r.json();return Boolean(j.records?.find((x:any)=>x.key==='los.journal')?.data?.some((x:any)=>x.description?.includes('PostgreSQL sync')));
 }),{timeout:20000}).toBe(true);
 await page.goto('/#account');
 await expect(page.getByText('Signed in to local PostgreSQL')).toBeVisible();
});
test('logout revokes session and clears browser account cache',async({page})=>{
 await signup(page,stamp());
 await page.getByRole('button',{name:/Use cloud records on this device/}).click();
 await expect(page.getByText('Signed in to local PostgreSQL')).toBeVisible();
 await page.getByRole('button',{name:/Sign out and clear local account cache/}).click();
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 const status=await page.evaluate(async()=>{const r=await fetch('/api/v1/records');return r.status});
 expect(status).toBe(401);
});
test('offline learning remains usable without sign-in',async({page})=>{
 await page.goto('/#overview');await expect(page.locator('main h1').first()).toBeVisible();
 await page.goto('/#builder');await expect(page.getByRole('textbox',{name:'Learning goal'})).toBeVisible();
});
