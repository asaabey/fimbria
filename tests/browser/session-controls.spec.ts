import {test,expect} from '@playwright/test';

test('compact teacher controls support guarded arrow navigation and an inline slide picker',async({page,context})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Upload lesson JSON').setInputFiles('examples/intro.json');
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const controls=page.getByRole('region',{name:'Session controls'});
  await expect(controls.getByRole('heading')).toHaveCount(0);
  await expect(controls.getByRole('img',{name:'0 participants',exact:true})).toBeVisible();
  await expect(controls.getByRole('img',{name:'0 responses',exact:true})).toBeVisible();
  await expect(controls.getByRole('link',{name:'Download lesson PDF',exact:true})).toBeVisible();
  await expect(controls.getByRole('link')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const display=await context.newPage();
  try{
    await display.goto(page.url().replace('/host/','/display/'));
    await page.getByRole('button',{name:'Begin lesson'}).click();
    const progress=page.getByRole('progressbar',{name:'Lesson progress'});
    await expect(progress).toHaveAttribute('aria-valuenow','1');
    await page.keyboard.press('ArrowLeft');
    await expect(progress).toHaveAttribute('aria-valuenow','1');
    await page.keyboard.down('ArrowRight');
    await expect(progress).toHaveAttribute('aria-valuenow','2');
    await page.keyboard.down('ArrowRight');
    await page.keyboard.up('ArrowRight');
    await expect(progress).toHaveAttribute('aria-valuenow','2');
    await expect(display.getByRole('progressbar')).toHaveAttribute('aria-valuenow','2');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(progress).toHaveAttribute('aria-valuenow','2');
    await page.keyboard.press('ArrowLeft');
    await expect(progress).toHaveAttribute('aria-valuenow','1');
    const picker=page.getByLabel('Jump to slide');
    const jump=page.getByRole('button',{name:'Go to slide',exact:true});
    const selectBox=(await picker.boundingBox())!,jumpBox=(await jump.boundingBox())!;
    expect(Math.abs(selectBox.y-jumpBox.y)).toBeLessThan(1);
    await picker.selectOption('5');
    await picker.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await expect(progress).toHaveAttribute('aria-valuenow','1');
    await picker.selectOption('5');
    await jump.click();
    await expect(progress).toHaveAttribute('aria-valuenow','6');
    await page.keyboard.press('ArrowRight');
    await expect(progress).toHaveAttribute('aria-valuenow','6');
    // The projector has no teacher keyboard handler.
    await display.keyboard.press('ArrowLeft');
    await expect(progress).toHaveAttribute('aria-valuenow','6');
    await page.keyboard.press('ArrowLeft');
    await expect(progress).toHaveAttribute('aria-valuenow','5');
    await expect(controls.getByRole('button',{name:'Reveal results'})).toBeVisible();
    const desktop=(await controls.boundingBox())!;
    expect(desktop.height).toBeLessThan(310);
    await page.screenshot({path:'test-results/compact-session-controls.png',fullPage:true});
    for(const theme of ['light','dark','paper']){
      await page.getByLabel('Theme',{exact:true}).selectOption(theme);
      await controls.screenshot({path:`test-results/compact-controls-${theme}.png`});
    }
    await page.setViewportSize({width:375,height:812});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await controls.screenshot({path:'test-results/compact-controls-mobile.png'});
    await controls.getByRole('button',{name:'End session'}).click();
    await expect(page.getByText('Session complete')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Session complete')).toBeVisible();
  }finally{await display.close();}
});
