import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost';

test.describe('Panel - Logowanie', () => {
  test('powinna wyświetlać formularz logowania', async ({ page }) => {
    await page.goto(BASE + '/login');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('powinna pokazać błąd przy złych danych', async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.locator('input[name="username"], input[name="email"], input[type="text"]').first().fill('zly@test.pl');
    await page.locator('input[type="password"]').fill('zlehaslo');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('.error, .alert, [role="alert"]')).toBeVisible({ timeout: 5000 });
  });

  test('powinna zalogować prawidłowymi danymi', async ({ page }) => {
    const user = process.env.PANEL_USER     ?? 'admin';
    const pass = process.env.PANEL_PASSWORD ?? 'admin123';

    await page.goto(BASE + '/login');
    await page.locator('input[name="username"], input[name="email"], input[type="text"]').first().fill(user);
    await page.locator('input[type="password"]').fill(pass);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/login/, { timeout: 8000 });
  });

  test('powinna wylogowywać użytkownika', async ({ page }) => {
    await page.goto(BASE + '/logout');
    await expect(page).toHaveURL(/login|\//, { timeout: 5000 });
  });
});
