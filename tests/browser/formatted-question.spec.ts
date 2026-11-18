import {test,expect} from '@playwright/test';

test('formatted question prompts and options preserve voting, results and handouts',async({page,context,browser})=>{
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Upload lesson JSON').setInputFiles('examples/formatted-question.json');
  const preview=page.locator('.lesson-preview');
  await expect(preview.locator('.text-underline')).toHaveText('reconsider an assumption');
  await expect(preview.getByText('Correct: Look for another explanation.')).toBeVisible();
  expect(await preview.locator('.text-marker').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  const handoutUrl=(await page.getByRole('link',{name:'Download PDF',exact:true}).getAttribute('href'))!;
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const code=(await page.locator('.roomCode').textContent())!;
  const display=await context.newPage();
  const studentContext=await browser.newContext({viewport:{width:375,height:812}});
  try{
    await display.goto((await page.getByRole('link',{name:'Open presentation display ↗'}).getAttribute('href'))!);
    const student=await studentContext.newPage();
    await student.goto('/join?code='+code);
    await student.getByRole('button',{name:'Join',exact:true}).click();
    await page.getByRole('button',{name:'Begin lesson'}).click();
    for(const screen of [page,display,student]){
      const heading=screen.getByRole('heading',{name:'Which habit helps you reconsider an assumption?'});
      await expect(heading.locator('strong')).toHaveText('habit');
      await expect(heading.locator('.text-underline')).toBeVisible();
      await expect(screen.locator('.options .text-marker strong')).toHaveText('another explanation');
      await expect(screen.locator('.options mark:not(.text-marker)')).toHaveText('new evidence');
      await expect(screen.locator('.options')).not.toContainText('[marker]');
      await expect(screen.locator('.options')).not.toContainText('Correct answer');
      await expect(screen.locator('.correct-answer-text')).toHaveCount(0);
    }
    await expect(page.getByLabel('Jump to slide').locator('option:checked')).toHaveText('1. Which habit helps you reconsider an assumption?');
    const marker=student.locator('.options .text-marker');
    await marker.evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished));});
    const firstStart=await marker.evaluate(el=>el.getAnimations()[0].startTime);
    // Clicking the formatted child must submit the option id just like clicking its button.
    await marker.locator('strong').click();
    await expect(student.getByText('Answer submitted and saved.')).toBeVisible();
    await expect(student.getByRole('button',{name:'A. Look for another explanation — Your answer'})).toBeDisabled();
    await expect(page.getByText('1 participants · 1 responses')).toBeVisible();
    expect(await marker.evaluate(el=>el.getAnimations()[0].startTime)).toBe(firstStart);
    await page.getByRole('button',{name:'Reveal results'}).click();
    await expect(display.getByText('1 responses · Correct answer')).toBeVisible();
    // The automatic reveal marker takes precedence over an author's yellow marker.
    expect(await marker.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    for(const screen of [page,display,student]){
      const correct=screen.locator('.correct-answer-text');
      await expect(correct).toHaveCount(1);
      await expect(correct).toHaveText('Look for another explanation');
      expect(await correct.evaluate(el=>getComputedStyle(el).animationName)).toBe('correct-answer-sweep');
      expect(await correct.evaluate(el=>getComputedStyle(el).animationIterationCount)).toBe('1');
    }
    await display.locator('.correct-answer-text').evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished));});
    const revealStart=await display.locator('.correct-answer-text').evaluate(el=>el.getAnimations()[0].startTime);
    const themeColours={light:'rgb(216, 235, 217)',dark:'rgb(41, 78, 59)',paper:'rgb(229, 222, 192)'};
    for(const theme of ['light','dark','paper'] as const){
      for(const screen of [page,display,student]){
        await screen.getByLabel('Theme',{exact:true}).selectOption(theme);
        await expect(screen.locator('html')).toHaveAttribute('data-theme',theme);
        const colours=await screen.locator('.correct-answer-text').evaluate(el=>{
          const style=getComputedStyle(el);
          const channels=(value:string)=>value.match(/\d+/g)!.slice(0,3).map(Number).map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
          const luminance=(value:string)=>{const [r,g,b]=channels(value);return .2126*r+.7152*g+.0722*b;};
          const colour=style.color;
          const token=style.getPropertyValue('--correct-highlight').trim();
          const a=luminance(colour),b=luminance(token.startsWith('#')?'rgb('+token.slice(1).match(/../g)!.map(hex=>parseInt(hex,16)).join(',')+')':token);
          return {background:style.backgroundImage,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size:style.backgroundSize};
        });
        expect(colours.background).toContain(themeColours[theme]);
        expect(colours.contrast).toBeGreaterThanOrEqual(4.5);
        expect(colours.size).toBe('100% 70%');
      }
      expect(await display.locator('.correct-answer-text').evaluate(el=>el.getAnimations()[0].startTime)).toBe(revealStart);
      expect(await student.locator('.correct-answer .answer').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
      await display.screenshot({path:`test-results/correct-answer-${theme}-display.png`,fullPage:true});
      await student.screenshot({path:`test-results/correct-answer-${theme}-mobile.png`,fullPage:true});
    }
    // System theme changes also update the settled marker without replaying it.
    await display.getByLabel('Theme',{exact:true}).selectOption('system');
    for(const scheme of ['light','dark'] as const){
      await display.emulateMedia({colorScheme:scheme});
      await expect(display.locator('html')).toHaveAttribute('data-theme',scheme);
      expect(await display.locator('.correct-answer-text').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain(themeColours[scheme]);
      expect(await display.locator('.correct-answer-text').evaluate(el=>el.getAnimations()[0].startTime)).toBe(revealStart);
    }
    await student.reload();
    await expect(student.getByRole('button',{name:'A. Look for another explanation — Your answer'})).toBeDisabled();
    await student.emulateMedia({reducedMotion:'reduce'});
    expect(await marker.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    expect(await student.locator('.correct-answer-text').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await display.screenshot({path:'test-results/formatted-question-display.png',fullPage:true});
    await student.screenshot({path:'test-results/formatted-question-mobile.png',fullPage:true});
    const handout=await context.newPage();
    await handout.addInitScript(()=>{window.print=()=>{};});
    await handout.goto(handoutUrl);
    await expect(handout.locator('h2 .text-underline')).toHaveText('reconsider an assumption');
    await expect(handout.locator('.handout-options .text-marker strong')).toHaveText('another explanation');
    expect(await handout.locator('.handout-options .text-marker').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    expect(await handout.locator('.correct-answer-text').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    await handout.emulateMedia({media:'print'});
    expect(await handout.locator('.correct-answer-text').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain(themeColours.light);
    expect(await handout.locator('.text-fade').first().evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
    await handout.close();
  }finally{await display.close();await studentContext.close();}
});
