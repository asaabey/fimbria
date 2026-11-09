import {test, expect} from '@playwright/test';

test('themes follow the system and persist across screens and refreshes', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'});
  await page.goto('/');
  await expect(page).toHaveTitle('Fimbria — Live lessons');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const selector = page.getByLabel('Theme', {exact: true});
  await expect(selector).toHaveValue('system');
  await selector.selectOption('paper');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
  await page.reload();
  await expect(selector).toHaveValue('paper');
  await page.getByRole('link', {name: 'Join a class', exact: true}).click();
  await expect(selector).toHaveValue('paper');
  await selector.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await selector.selectOption('system');
  await page.emulateMedia({colorScheme: 'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({colorScheme: 'dark'});
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('themes fit mobile screens and remain usable with keyboard', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  await page.goto('/join');
  for (const theme of ['light', 'dark', 'paper']) {
    await page.getByLabel('Theme', {exact: true}).selectOption(theme);
    await expect(page.getByLabel('Room code')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: 'test-results/fimbria-' + theme + '.png', fullPage: true});
  }
  await page.getByLabel('Theme', {exact: true}).focus();
  await expect(page.getByLabel('Theme', {exact: true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Room code')).toBeFocused();
});
