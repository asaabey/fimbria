import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('YouTube links embed in preview and all classroom views with a fallback link',async({page,context,browser})=>{
  // Stub the external player so the UI test is deterministic and works offline.
  const embed='https://www.youtube.com/embed/M7lc1UVf-VE?playsinline=1&start=90';
  await context.route('https://www.youtube.com/embed/**',route=>route.fulfill({contentType:'text/html',body:'<p>YouTube player fixture</p>'}));
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const lesson={schemaVersion:1,id:'youtube',title:'A YouTube lesson',steps:[
    {id:'youtube',type:'video',title:'Video explanation',src:'https://youtu.be/M7lc1UVf-VE?t=1m30s'},
    {id:'next',type:'slide',title:'Discuss the video',body:'What did you notice?'},
  ]};
  await page.getByLabel('Upload lesson JSON').setInputFiles({name:'youtube.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lesson))});
  await expect(page.locator('iframe')).toHaveAttribute('src',embed);
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const display=await context.newPage();
  await display.goto((await page.getByRole('link',{name:'Open presentation display ↗'}).getAttribute('href'))!);
  const studentContext=await browser.newContext({viewport:{width:375,height:812}});
  try {
    await studentContext.route('https://www.youtube.com/embed/**',route=>route.fulfill({contentType:'text/html',body:'<p>YouTube player fixture</p>'}));
    const student=await studentContext.newPage();
    await student.goto((await page.locator('section a').first().getAttribute('href'))!);
    await student.getByRole('button',{name:'Join',exact:true}).click();
    await expect(student.getByText('Waiting for your teacher…')).toBeVisible();
    await page.getByRole('button',{name:'Begin lesson'}).click();
    for(const screen of [page,display,student]){
      const frame=screen.getByTitle('Video explanation',{exact:true});
      await expect(frame).toBeVisible();
      await expect(frame).toHaveAttribute('src',embed);
      await expect(frame).toHaveAttribute('allowfullscreen','');
      await expect(frame).toHaveAttribute('referrerpolicy','strict-origin-when-cross-origin');
      await expect(screen.getByRole('link',{name:'Watch on YouTube ↗'})).toHaveAttribute('href',lesson.steps[0].src!);
    }
    expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/youtube-host.png',fullPage:true});
    await student.screenshot({path:'test-results/youtube-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'Next',exact:true}).click();
    for(const screen of [page,display,student]){
      await expect(screen.locator('iframe')).toHaveCount(0);
      await expect(screen.getByRole('heading',{name:'Discuss the video'})).toBeVisible();
    }
    await page.getByRole('button',{name:'Previous',exact:true}).click();
    await expect(page.locator('iframe')).toHaveAttribute('src',embed);
  } finally {await studentContext.close();await display.close();}
});

test('MP4 plays in preview and classroom, stops on navigation, and reports missing media',async({page,context,browser})=>{
  const media=await readFile('tests/fixtures/video.mp4');
  await context.route('**/media/test-video.mp4',route=>route.fulfill({contentType:'video/mp4',body:media}));
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const lesson=JSON.parse(await readFile('examples/video.json','utf8'));
  lesson.steps[1].src='/media/test-video.mp4';
  lesson.steps.splice(2,0,{id:'missing',type:'video',title:'Missing animation',src:'/media/missing.mp4'});
  await page.getByLabel('Upload lesson JSON').setInputFiles({name:'video.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lesson))});
  const preview=page.locator('video').first();
  await expect(preview).toBeVisible();
  await expect.poll(()=>preview.evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(1);
  await preview.evaluate((v:HTMLVideoElement)=>v.play());
  await expect.poll(()=>preview.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const display=await context.newPage();
  await display.goto((await page.getByRole('link',{name:'Open presentation display ↗'}).getAttribute('href'))!);
  const studentContext=await browser.newContext({viewport:{width:375,height:812}});
  try {
    await studentContext.route('**/media/test-video.mp4',route=>route.fulfill({contentType:'video/mp4',body:media}));
    const student=await studentContext.newPage();
    await student.goto((await page.locator('section a').first().getAttribute('href'))!);
    await student.getByRole('button',{name:'Join',exact:true}).click();
    await expect(student.getByText('Waiting for your teacher…')).toBeVisible();
    await page.getByRole('button',{name:'Begin lesson'}).click();
    await page.getByRole('button',{name:'Next',exact:true}).click();
    for(const screen of [page,display,student]){
      await expect(screen.locator('video')).toHaveAttribute('controls','');
      await expect(screen.locator('video')).toHaveAttribute('playsinline','');
      await expect.poll(()=>screen.locator('video').evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(1);
    }
    await expect(student.getByRole('button',{name:'Reveal results'})).toHaveCount(0);
    expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await display.locator('video').evaluate((v:HTMLVideoElement)=>v.play());
    await expect.poll(()=>display.locator('video').evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(0);
    await page.screenshot({path:'test-results/video-host.png',fullPage:true});
    await student.screenshot({path:'test-results/video-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('Unable to load this video');
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await expect(display.locator('video')).toHaveCount(0);
    await student.getByRole('button',{name:'A. Yes'}).click();
    await expect(student.getByText('Answer submitted and saved.')).toBeVisible();
    await page.getByRole('button',{name:'Previous',exact:true}).click();
    await page.getByRole('button',{name:'Previous',exact:true}).click();
    await expect(page.locator('video')).toHaveAttribute('src','/media/test-video.mp4');
    await expect.poll(()=>page.locator('video').evaluate((v:HTMLVideoElement)=>v.currentTime)).toBe(0);
  } finally {await studentContext.close();await display.close();}
});
