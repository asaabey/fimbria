import {test,expect} from '@playwright/test';
import lesson from '../../examples/tables.json' with {type:'json'};

test('tables render with headers on every screen and fit phones without page scroll',async({page,context,browser})=>{
  await page.setViewportSize({width:1366,height:900});
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const wide={...lesson,id:'tables-wide',steps:[...lesson.steps,{id:'wide',type:'slide',title:'Wide table',body:'',table:{columns:['Analyte','Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'],rows:[['Creatinine (µmol/L)','118','164','212','245','230','190','150']]}}]};
  await page.getByLabel('Upload lesson JSON').setInputFiles({name:'tables.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(wide))});
  await expect(page.locator('.preview-steps table')).toHaveCount(3);
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
    for(const screen of [page,display,student]){
      const table=screen.getByRole('table',{name:'Adult serum reference ranges'});
      await expect(table).toBeVisible();
      await expect(table.getByRole('columnheader',{name:'Range'})).toBeVisible();
      await expect(table.getByRole('cell',{name:'3.5–5.2'})).toBeVisible();
    }
    await page.getByRole('button',{name:'Next',exact:true}).click();
    for(const screen of [page,display,student]){
      const table=screen.getByRole('table',{name:'Results today'});
      await expect(table.getByRole('rowheader',{name:'Potassium'})).toBeVisible();
      await expect(table.getByRole('cell',{name:'6.8 mmol/L'})).toBeVisible();
    }
    // The table sits between the prompt and the answer buttons on the phone.
    const tableBox=(await student.locator('.lesson-table').boundingBox())!,firstAnswer=(await student.getByRole('button',{name:/Perform a 12-lead ECG/}).boundingBox())!;
    expect(tableBox.y+tableBox.height).toBeLessThanOrEqual(firstAnswer.y);
    await student.screenshot({path:'test-results/table-question-mobile.png',fullPage:true});
    await display.screenshot({path:'test-results/table-question-display.png'});
    await page.getByRole('button',{name:'Next',exact:true}).click();
    const region=student.getByRole('region',{name:/^Table: Analyte/});
    await expect(region).toBeVisible();
    expect(await region.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
    expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await student.screenshot({path:'test-results/table-wide-mobile.png',fullPage:true});
  }finally{await studentContext.close();await display.close();}
});
