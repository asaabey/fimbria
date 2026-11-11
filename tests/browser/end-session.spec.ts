import {test,expect} from '@playwright/test';
import fixture from '../../examples/intro.json' with {type:'json'};

test('teacher ends an unfinished session from the home page',async({page,browser})=>{
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const title='End-session test '+Date.now();
  await page.getByLabel('Upload lesson JSON').setInputFiles({name:'end.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...fixture,id:'end-test',title}))});
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const code=(await page.locator('.roomCode').textContent())!;
  const studentContext=await browser.newContext();
  try{
    const student=await studentContext.newPage();
    await student.goto('/join?code='+code);
    await student.getByRole('button',{name:'Join',exact:true}).click();
    await page.getByRole('button',{name:'Begin lesson'}).click();
    await expect(student.getByRole('heading',{name:fixture.steps[0].title})).toBeVisible();

    await page.goto('/');
    const row=page.locator('.resume-sessions li',{hasText:`Room ${code}`});
    await expect(row).toContainText(title);
    await expect(row).toContainText(`Step 1 of ${fixture.steps.length} · 1 student · last activity`);
    await row.getByRole('button',{name:`End room ${code}`}).click();
    const confirm=page.getByRole('group',{name:`Confirm ending room ${code}`});
    await confirm.getByRole('button',{name:'Cancel'}).click();
    await expect(row).toBeVisible();
    await row.getByRole('button',{name:`End room ${code}`}).click();
    await confirm.getByRole('button',{name:'End',exact:true}).click();
    await expect(page.locator('.resume-sessions li',{hasText:`Room ${code}`})).toHaveCount(0);
    // Connected screens learn immediately, and the student can now download the handout.
    await expect(student.getByRole('heading',{name:'Session complete'})).toBeVisible();
    await expect(student.getByRole('link',{name:'Download lesson PDF'})).toBeVisible();
    await page.screenshot({path:'test-results/unfinished-sessions.png',fullPage:true});
  }finally{await studentContext.close();}
});

test('ending a session requires a teacher login',async({request})=>{
  expect((await request.post('/api/rooms/anything/end')).status()).toBe(401);
  expect((await request.post('/api/rooms/end-all')).status()).toBe(401);
});
