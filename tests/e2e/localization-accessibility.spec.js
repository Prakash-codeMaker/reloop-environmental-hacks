import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('reloop-language');
    localStorage.setItem('reloop-mode', JSON.stringify('demo'));
    localStorage.setItem('reloop-demo-v2-role', JSON.stringify('generator'));
  });
});

test('language selection updates document locale and persists after reload', async ({ page }) => {
  await page.goto('/');
  const picker = page.locator('.top-language select');
  await expect(picker).toBeVisible();
  await picker.selectOption('mr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'mr-IN');
  await expect(page.locator('.side-nav')).toContainText('माझ्या नोंदी');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'mr-IN');
  await expect(page.locator('.top-language select')).toHaveValue('mr');
});

test('keyboard skip link reaches the main content landmark', async ({ page }) => {
  await page.goto('/');
  const skip = page.getByRole('link', { name: /skip to main content/i });
  await expect(skip).toBeAttached();
  await skip.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('demo shell has no serious or critical automated axe violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations.filter(v => ['serious', 'critical'].includes(v.impact));
  expect(serious, JSON.stringify(serious.map(v => ({ id: v.id, help: v.help, nodes: v.nodes.length })), null, 2)).toEqual([]);
});

test('mobile viewport keeps the language picker and main landmark usable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.locator('.top-language select')).toBeVisible();
  await page.locator('.top-language select').selectOption('hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi-IN');
});


test('switching language updates navigation in all seven supported languages', async ({ page }) => {
  const cases = [
    ['en', 'My listings'],
    ['hi', 'मेरी लिस्टिंग'],
    ['mr', 'माझ्या नोंदी'],
    ['gu', 'મારી યાદીઓ'],
    ['ta', 'என் பட்டியல்கள்'],
    ['te', 'నా జాబితాలు'],
    ['kn', 'ನನ್ನ ಪಟ್ಟಿಗಳು'],
  ];
  await page.goto('/');
  const picker = page.locator('.top-language select');
  for (const [language, label] of cases) {
    await picker.selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang', `${language === 'en' ? 'en' : language}-IN`);
    await expect(page.locator('.side-nav')).toContainText(label);
  }
});
