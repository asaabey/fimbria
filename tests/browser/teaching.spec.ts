import {test,expect} from '@playwright/test';
test('teacher presents and two isolated students vote',async({page,browser})=>{
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Upload lesson JSON').setInputFiles('examples/intro.json');
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const url=await page.locator('section a').first().getAttribute('href');
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  const students=await Promise.all(contexts.map(c=>c.newPage()));
  for(const s of students){await s.goto(url!);await s.getByRole('button',{name:'Join',exact:true}).click();await expect(s.getByText('Waiting for your teacher…')).toBeVisible();}
  await page.getByRole('button',{name:'Begin lesson'}).click();
  await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();
  for(const s of students){await s.getByRole('button',{name:/A\. It can/}).click();await expect(s.getByText('Answer submitted and saved.')).toBeVisible();}
  await students[0].reload();await expect(students[0].getByText('Answer submitted and saved.')).toBeVisible();
  await page.getByRole('button',{name:'Reveal results'}).click();
  await expect(students[0].getByText(/2 responses/)).toBeVisible();
  await page.getByRole('button',{name:'End session'}).click();
  await expect(students[1].getByText('Session complete')).toBeVisible();
  await page.screenshot({path:'test-results/teacher.png',fullPage:true});
  for(const c of contexts)await c.close();
});

test('GitHub import reports errors and previews a successful import',async({page,request})=>{
  const fixture=JSON.parse(await (await import('node:fs/promises')).readFile('examples/intro.json','utf8'));
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('button',{name:'Import lesson',exact:true})).toBeDisabled();
  await page.getByLabel('GitHub lesson URL').fill('https://example.com/lesson.json');
  await page.getByRole('button',{name:'Import lesson',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('github.com');
  const rejected=await request.post('/api/lessons/import',{data:{url:'https://example.com/lesson.json'}});
  expect(rejected.status()).toBe(401);
  // Seed the stored lesson; stub only the external-import response for a deterministic UI check.
  const saved=await page.request.post('/api/lessons',{data:fixture});
  const imported=await saved.json();
  await page.route('**/api/lessons/import',async route=>{
    expect(route.request().postDataJSON()).toEqual({url:'https://github.com/teacher/lessons/blob/main/lesson.json'});
    await route.fulfill({json:imported});
  });
  await page.getByLabel('GitHub lesson URL').fill('https://github.com/teacher/lessons/blob/main/lesson.json');
  await page.getByRole('button',{name:'Import lesson',exact:true}).click();
  await expect(page.getByLabel('Saved lessons')).toHaveValue(imported.id);
  await expect(page.getByRole('heading',{name:fixture.title,exact:true})).toBeVisible();
  await expect(page.getByLabel('GitHub lesson URL')).toHaveValue('');
  await page.screenshot({path:'test-results/github-import.png',fullPage:true});
});
