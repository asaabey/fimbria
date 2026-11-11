import {test,expect} from '@playwright/test';
import fixture from '../../examples/intro.json' with {type:'json'};

test('session top bar shows connection and room, and a progress bar tracks the step',async({page,context,browser})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Upload lesson JSON').setInputFiles({name:'intro.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...fixture,id:'header-test'}))});
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const code=(await page.locator('.roomCode').textContent())!;
  const display=await context.newPage();
  await display.setViewportSize({width:1920,height:1080});
  await display.goto((await page.getByRole('link',{name:'Open presentation display ↗'}).getAttribute('href'))!);
  const studentContext=await browser.newContext({viewport:{width:375,height:812}});
  try{
    const student=await studentContext.newPage();
    await student.goto('/join?code='+code);
    await student.getByRole('button',{name:'Join',exact:true}).click();
    await page.getByRole('button',{name:'Begin lesson'}).click();
    await page.getByRole('button',{name:'Next',exact:true}).click();
    for(const screen of [page,display,student]){
      const header=screen.locator('header');
      await expect(header.getByRole('status')).toContainText('Connected');
      await expect(header.locator('.room-badge')).toHaveText(`Room ${code}`);
      await expect(header.getByRole('link',{name:'Join a class'})).toHaveCount(0);
      const bar=screen.getByRole('progressbar',{name:'Lesson progress'});
      await expect(bar).toHaveAttribute('aria-valuenow','2');
      await expect(bar).toHaveAttribute('aria-valuetext',`Step 2 of ${fixture.steps.length}`);
      expect(await screen.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    // The lesson title now sits close under the top bar.
    for(const screen of [page,display,student])expect((await screen.locator('.session-title').boundingBox())!.y).toBeLessThan(140);
    // The phone keeps the top bar on one row.
    const bar=(await student.locator('header').boundingBox())!;
    expect(bar.height).toBeLessThan(64);
    await page.screenshot({path:'test-results/header-teacher.png'});
    await display.screenshot({path:'test-results/header-display.png'});
    await student.screenshot({path:'test-results/header-mobile.png'});
    // Without a socket connection the plug shows unplugged and students are reassured.
    const offline=await studentContext.newPage();
    await offline.route('**/socket.io/**',route=>route.abort());
    await offline.goto('/play/'+code);
    await expect(offline.locator('header .connection.offline')).toBeVisible();
    await expect(offline.getByText('Reconnecting… Your recorded answer is saved.')).toBeVisible();
    await offline.screenshot({path:'test-results/header-mobile-offline.png'});
  }finally{await studentContext.close();await display.close();}
});
