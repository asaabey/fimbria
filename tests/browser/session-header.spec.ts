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
    // Lobby: the session timer has not started, and the big lobby QR is the only one.
    await expect(page.locator('header .session-time')).toContainText('Not started');
    await expect(page.locator('.join-corner')).toHaveCount(0);
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
    // Teacher screen only: running clock, session timer ticking each second, and the join corner.
    await expect(page.locator('header .current-time time')).toHaveText(/^\d{1,2}:\d{2}/);
    const elapsed=page.locator('header .session-time .elapsed');
    await expect(elapsed).toHaveText(/^0:0\d$/);
    const before=await elapsed.textContent();
    await expect(elapsed).not.toHaveText(before!,{timeout:3000});
    const corner=page.getByRole('complementary',{name:'Join this class'});
    await expect(corner).toContainText(code);
    await expect(corner.getByRole('img',{name:`QR code to join room ${code}`})).toBeVisible();
    const box=(await corner.boundingBox())!;
    const controls=(await page.getByRole('region',{name:'Session controls'}).boundingBox())!;
    expect(box.x).toBeCloseTo(controls.x,0);
    expect(box.width).toBeCloseTo(controls.width,0);
    expect(box.y-controls.y-controls.height).toBeCloseTo(16,0);
    await page.setViewportSize({width:800,height:900});
    await expect(corner).toBeHidden();
    await page.setViewportSize({width:1366,height:900});
    // Jumping updates every screen, and normal navigation keeps the picker in sync.
    const picker=page.getByLabel('Jump to slide');
    await expect(picker).toHaveValue('1');
    await expect(page.getByRole('button',{name:'Go to slide',exact:true})).toBeDisabled();
    await picker.selectOption('4');
    await page.getByRole('button',{name:'Go to slide',exact:true}).click();
    for(const screen of [page,display,student])await expect(screen.getByRole('progressbar',{name:'Lesson progress'})).toHaveAttribute('aria-valuenow','5');
    await page.getByRole('button',{name:'Previous',exact:true}).click();
    await expect(picker).toHaveValue('3');
    await picker.selectOption('0');
    await page.getByRole('button',{name:'Go to slide',exact:true}).click();
    for(const screen of [page,display,student])await expect(screen.getByRole('progressbar',{name:'Lesson progress'})).toHaveAttribute('aria-valuenow','1');
    await expect(page.getByRole('button',{name:'Previous',exact:true})).toBeDisabled();
    for(const screen of [display,student]){
      await expect(screen.locator('header .status-badge')).toHaveCount(0);
      await expect(screen.locator('.join-corner')).toHaveCount(0);
    }
    // The lesson title now sits close under the top bar.
    for(const screen of [page,display,student])expect((await screen.locator('.session-title').boundingBox())!.y).toBeLessThan(140);
    // The phone keeps the top bar on one row.
    const bar=(await student.locator('header').boundingBox())!;
    expect(bar.height).toBeLessThan(64);
    await page.screenshot({path:'test-results/header-teacher.png'});
    await display.screenshot({path:'test-results/header-display.png'});
    await student.screenshot({path:'test-results/header-mobile.png'});
    // Ending freezes the timer and removes the join corner.
    await page.getByRole('button',{name:'End session'}).click();
    await expect(page.locator('header .session-time')).toHaveClass(/stopped/);
    await expect(page.locator('.join-corner')).toHaveCount(0);
    await expect(page.getByLabel('Jump to slide')).toHaveCount(0);
    const frozen=await elapsed.textContent();
    await page.waitForTimeout(1500);
    await expect(elapsed).toHaveText(frozen!);
    // Without a socket connection the plug shows unplugged and students are reassured.
    const offline=await studentContext.newPage();
    await offline.route('**/socket.io/**',route=>route.abort());
    await offline.goto('/play/'+code);
    await expect(offline.locator('header .connection.offline')).toBeVisible();
    await expect(offline.getByText('Reconnecting… Your recorded answer is saved.')).toBeVisible();
    await offline.screenshot({path:'test-results/header-mobile-offline.png'});
  }finally{await studentContext.close();await display.close();}
});
