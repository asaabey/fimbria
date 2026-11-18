import {test,expect} from '@playwright/test';
import lesson from '../../examples/text-effects.json' with {type:'json'};

test('lesson text effects animate once per appearance and remain readable in static views',async({page,context,browser})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Upload lesson JSON').setInputFiles('examples/text-effects.json');
  const preview=page.locator('.lesson-preview .text-marker').first();
  await expect(preview).toHaveText('Notice the key evidence.');
  expect(await preview.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  const handoutUrl=(await page.getByRole('link',{name:'Download PDF',exact:true}).getAttribute('href'))!;
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const code=(await page.locator('.roomCode').textContent())!;
  const display=await context.newPage();
  const studentContext=await browser.newContext({viewport:{width:375,height:812}});
  try{
    await display.goto(page.url().replace('/host/','/display/'));
    await page.getByRole('button',{name:'Begin lesson'}).click();
    const marker=display.locator('.text-marker');
    await expect(marker).toBeVisible();
    await marker.evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished));});
    const firstStart=await marker.evaluate(el=>el.getAnimations()[0].startTime);
    const student=await studentContext.newPage();
    await student.goto('/join?code='+code);
    await student.getByRole('button',{name:'Join',exact:true}).click();
    for(const screen of [page,display,student]){
      for(const [name,animation] of [['marker','text-marker-sweep'],['underline','text-underline-draw'],['fade','text-fade-rise']]){
        const effect=screen.locator('.text-'+name);
        await expect(effect).toBeVisible();
        expect(await effect.evaluate(el=>getComputedStyle(el).animationName)).toBe(animation);
        expect(await effect.evaluate(el=>getComputedStyle(el).animationIterationCount)).toBe('1');
      }
    }
    await expect(page.getByRole('img',{name:'1 participants',exact:true})).toBeVisible();
    expect(await marker.evaluate(el=>el.getAnimations()[0].startTime)).toBe(firstStart);
    expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await student.emulateMedia({reducedMotion:'reduce'});
    for(const name of ['marker','underline','fade'])expect(await student.locator('.text-'+name).evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    expect(await student.locator('.text-fade').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await expect(display.locator('.text-marker')).toHaveCount(0);
    await student.getByRole('button',{name:/A\. Look for/}).click();
    await page.getByRole('button',{name:'Reveal results'}).click();
    for(const screen of [page,display,student])await expect(screen.locator('.text-marker')).toHaveText('Review the evidence');
    await page.getByRole('button',{name:'Previous',exact:true}).click();
    await expect(marker).toHaveText('Notice the key evidence.');
    await marker.evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished));});
    expect(await marker.evaluate(el=>el.getAnimations()[0].startTime)).not.toBe(firstStart);
    await display.screenshot({path:'test-results/text-effects-live.png'});
    await student.screenshot({path:'test-results/text-effects-reduced-motion.png',fullPage:true});
    await display.emulateMedia({media:'print'});
    expect(await marker.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    const handout=await context.newPage();
    await handout.addInitScript(()=>{window.print=()=>{};});
    await handout.goto(handoutUrl);
    await expect(handout.locator('.text-marker').first()).toHaveText('Notice the key evidence.');
    expect(await handout.locator('.text-marker').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    await expect(handout.locator('.handout-steps')).not.toContainText('[marker]');
    await expect(handout.getByRole('heading',{name:lesson.title,exact:true})).toBeVisible();
    await handout.close();
  }finally{await display.close();await studentContext.close();}
});
