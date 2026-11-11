import {test,expect} from '@playwright/test';
import fixture from '../../examples/intro.json' with {type:'json'};

// Runs in its own project after every other browser test (see playwright.config.ts), because it ends all sessions.
test('teacher ends every unfinished session at once',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Upload lesson JSON').setInputFiles({name:'all.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...fixture,id:'end-all'}))});
  for(const _ of [1,2]){await page.getByRole('button',{name:'Start session',exact:true}).click();await expect(page.getByText('Ready when you are.')).toBeVisible();await page.goto('/');await page.getByLabel('Saved lessons').selectOption({label:fixture.title});}
  await page.getByRole('button',{name:'End all',exact:true}).click();
  await page.getByRole('group',{name:'Confirm ending all sessions'}).getByRole('button',{name:'End all'}).click();
  await expect(page.locator('.resume-sessions')).toHaveCount(0);
});
