import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost';

test.describe('Panel - Ustawienia', () => {
  test('powinna załadować stronę ustawień', async ({ page }) => {
    await page.goto(BASE + '/settings');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/404|error/i);
  });

  test('powinna wyświetlać formularz ustawień', async ({ page }) => {
    await page.goto(BASE + '/settings');
    const form = page.locator('form, .settings-form, .settings-panel');
    await expect(form.first()).toBeVisible({ timeout: 8000 });
  });

  test('powinna zapisywać ustawienia po kliknięciu Zapisz', async ({ page }) => {
    await page.goto(BASE + '/settings');
    const saveBtn = page.locator('button[type="submit"], button').filter({ hasText: /zapisz|save|zaktualizuj|update/i });
    if (await saveBtn.count() > 0) {
      await saveBtn.first().click();
      await expect(page.locator('.alert, .toast, .notification, [role="alert"]').first()).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('powinna wyświetlać sekcje kategorii ustawień', async ({ page }) => {
    await page.goto(BASE + '/settings');
    const headings = page.locator('h1, h2, h3, .section-title');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });
});
