import {test,expect} from '@playwright/test';
import tables from '../../examples/tables.json' with {type:'json'};

// Record print calls instead of opening the dialog; the handout opens it automatically once images load.
const stubPrint=()=>{(window as any).printCalls=0;window.print=()=>{(window as any).printCalls++;};};
const lesson={...tables,id:'handout-lesson',title:'Handout lesson',steps:[
  {id:'strip',type:'slide',title:'Look before you label',body:'Describe, **in order**:\n- Rate\n- ==Rhythm==\n- Each wave',image:{src:'/media/sample-ecg-strip.svg',alt:'Lead II rhythm strip with peaked T waves',caption:'Sample strip'}},
  ...tables.steps,
  {id:'clip',type:'video',title:'Recap',src:'https://www.youtube.com/watch?v=M7lc1UVf-VE&t=90'},
]};

test('teacher and students download a printable lesson handout',async({page,context,browser})=>{
  await context.addInitScript(stubPrint);
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Upload lesson JSON').setInputFiles({name:'handout.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lesson))});
  await expect(page.locator('.preview-steps')).toBeVisible();

  // Teacher copy of a saved lesson: every step, answers marked, print dialog opened once.
  const [teacherCopy]=await Promise.all([context.waitForEvent('page'),page.getByRole('link',{name:'Download PDF',exact:true}).click()]);
  await expect(teacherCopy.getByRole('heading',{level:1,name:'Handout lesson'})).toBeVisible();
  await expect(teacherCopy.getByText('Teacher copy with answers')).toBeVisible();
  await expect(teacherCopy.locator('.handout-step')).toHaveCount(lesson.steps.length);
  await expect(teacherCopy.locator('.body ul li')).toHaveText(['Rate','Rhythm','Each wave']);
  await expect(teacherCopy.locator('.body mark')).toHaveText('Rhythm');
  await expect(teacherCopy.locator('li.correct')).toContainText('Perform a 12-lead ECG now');
  await expect(teacherCopy.getByRole('table',{name:'Results today'})).toBeVisible();
  await expect(teacherCopy.getByRole('link',{name:'https://www.youtube.com/watch?v=M7lc1UVf-VE&t=90'})).toBeVisible();
  await expect.poll(()=>teacherCopy.evaluate(()=>(window as any).printCalls)).toBe(1);
  expect(await teacherCopy.locator('.handout img').evaluate(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0)).toBe(true);
  expect(await teacherCopy.title()).toBe('Handout lesson — Fimbria handout');
  // The saved PDF: real print layout, no toolbar.
  await teacherCopy.emulateMedia({media:'print'});
  await expect(teacherCopy.locator('.handout-toolbar')).toBeHidden();
  await teacherCopy.pdf({path:'test-results/handout-teacher.pdf',format:'A4',printBackground:true});
  await teacherCopy.close();

  await page.getByRole('button',{name:'Start session',exact:true}).click();
  await expect(page.getByText('Ready when you are.')).toBeVisible();
  const studentContext=await browser.newContext({viewport:{width:375,height:812}});
  try{
    await studentContext.addInitScript(stubPrint);
    const student=await studentContext.newPage();
    const code=(await page.locator('.roomCode').textContent())!;
    await student.goto('/join?code='+code);
    await student.getByRole('button',{name:'Join',exact:true}).click();
    await expect(student.getByText('Waiting for your teacher…')).toBeVisible();
    await page.getByRole('button',{name:'Begin lesson'}).click();
    // "- " lines in a slide body show as a real bulleted list.
    const bullets=student.locator('.body ul li');
    await expect(bullets).toHaveText(['Rate','Rhythm','Each wave']);
    expect(await bullets.first().evaluate(li=>getComputedStyle(li).display)).toBe('list-item');
    // **bold** and ==highlight== stand out instead of showing their markers.
    await expect(student.locator('.body strong')).toHaveText('in order');
    await expect(student.locator('.body mark')).toHaveText('Rhythm');
    await expect(student.locator('.body')).not.toContainText('**');
    await student.screenshot({path:'test-results/bullets-mobile.png'});
    await student.evaluate(()=>{document.documentElement.dataset.theme='dark';});
    await student.screenshot({path:'test-results/emphasis-mobile-dark.png'});
    await student.evaluate(()=>{document.documentElement.dataset.theme='light';});
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await student.getByRole('button',{name:/Repeat the potassium/}).click();
    await expect(student.getByText('Answer submitted and saved.')).toBeVisible();

    // No spoilers: students cannot fetch the handout while the session runs.
    const early=await student.evaluate(async c=>{const res=await fetch('/api/handout?room='+c,{headers:{'X-Participant':localStorage.getItem('participant:'+c)!}});return res.status;},code);
    expect(early).toBe(409);
    await expect(student.getByRole('link',{name:'Download lesson PDF'})).toHaveCount(0);

    // Teacher's session copy during class includes class responses.
    const [sessionCopy]=await Promise.all([context.waitForEvent('page'),page.getByRole('link',{name:'Download lesson PDF ↗'}).click()]);
    await expect(sessionCopy.getByText('Includes class responses')).toBeVisible();
    await expect(sessionCopy.locator('li.correct')).toContainText('0 of 1 responses');
    await sessionCopy.close();

    await page.getByRole('button',{name:'End session'}).click();
    await expect(student.getByRole('heading',{name:'Session complete'})).toBeVisible();
    const [handout]=await Promise.all([studentContext.waitForEvent('page'),student.getByRole('link',{name:'Download lesson PDF'}).click()]);
    await expect(handout.getByText('Includes your answers')).toBeVisible();
    await expect(handout.locator('.handout-options li',{hasText:'Repeat the potassium'})).toContainText('Your answer');
    await expect(handout.locator('li.correct')).toContainText('✓ Correct answer');
    await expect(handout.getByText('Potassium of 6.8 mmol/L')).toBeVisible();
    await expect(handout.locator('.handout-options').getByText(/responses/)).toHaveCount(0);
    await expect.poll(()=>handout.evaluate(()=>(window as any).printCalls)).toBe(1);
    expect(await handout.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await handout.screenshot({path:'test-results/handout-student-mobile.png',fullPage:true});

    // Someone else's browser has no participant credential for this room.
    const stranger=await browser.newPage();
    await stranger.goto('/handout?room='+code);
    await expect(stranger.getByRole('alert')).toHaveText('Only participants in this session can download its handout');
    await stranger.close();
  }finally{await studentContext.close();}
});
