import {test,expect,type Page} from '@playwright/test';
import lesson from '../../examples/images.json' with {type:'json'};
const box=async(page:Page,selector:string)=>(await page.locator(selector).first().boundingBox())!;

test('step images sit in the right third on the projector and above the question on phones',async({page,context,browser})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Upload lesson JSON').setInputFiles({name:'images.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lesson))});
  await expect(page.locator('.preview-steps img')).toHaveCount(2);
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const display=await context.newPage();
  await display.setViewportSize({width:1920,height:1080});
  await display.goto((await page.getByRole('link',{name:'Open presentation display ↗'}).getAttribute('href'))!);
  const studentContext=await browser.newContext({viewport:{width:375,height:812}});
  try{
    const student=await studentContext.newPage();
    await student.goto((await page.locator('section a').first().getAttribute('href'))!);
    await student.getByRole('button',{name:'Join',exact:true}).click();
    await expect(student.getByText('Waiting for your teacher…')).toBeVisible();
    await page.getByRole('button',{name:'Begin lesson'}).click();
    for(const step of ['slide','question'] as const){
      const heading=step==='slide'?lesson.steps[0].title!:lesson.steps[1].prompt!;
      for(const screen of [page,display,student]){
        await expect(screen.getByRole('heading',{name:heading})).toBeVisible();
        const img=screen.getByRole('img',{name:lesson.steps[0].image.alt});
        await expect(img).toBeVisible();
        await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
        await expect(screen.getByRole('link',{name:/^Open full-size image/})).toHaveAttribute('href',lesson.steps[0].image.src);
      }
      // Projector and teacher view: image column to the right of the text, about a third of the step width.
      for(const screen of [display,page]){
        const layout=await box(screen,'.step-layout'),image=await box(screen,'.step-layout > .lesson-image'),main=await box(screen,'.step-main');
        expect(image.x).toBeGreaterThan(main.x+main.width-1);
        expect(image.width/layout.width).toBeGreaterThan(.27);
        expect(image.width/layout.width).toBeLessThan(.36);
      }
      // Phone: image spans the card and sits above the heading.
      const image=await box(student,'.step-layout > .lesson-image'),title=await box(student,'.step-main h2');
      expect(image.y+image.height).toBeLessThanOrEqual(title.y);
      expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await display.screenshot({path:`test-results/image-${step}-display.png`});
      await student.screenshot({path:`test-results/image-${step}-mobile.png`,fullPage:true});
      if(step==='slide')await page.getByRole('button',{name:'Next',exact:true}).click();
    }
    await expect(student.getByRole('button',{name:/Hyperkalaemia/})).toBeEnabled();
    await expect(display.getByText('Sample strip (illustrative drawing)')).toHaveCount(0);
  }finally{await studentContext.close();await display.close();}
});

test('a missing image shows its description instead of a broken picture',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const broken={...lesson,id:'broken',title:'Broken image',steps:[{...lesson.steps[0],image:{src:'/media/does-not-exist.png',alt:'Missing strip'}}]};
  await page.getByLabel('Upload lesson JSON').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(broken))});
  await expect(page.getByRole('alert').filter({hasText:'Image unavailable: Missing strip'})).toBeVisible();
});
