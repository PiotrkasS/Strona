import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost';

test.describe('Panel - Dashboard', () => {
  test('powinna załadować stronę główną panelu', async ({ page }) => {
    await page.goto(BASE + '/dashboard');
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('powinna wyświetlać menu nawigacyjne', async ({ page }) => {
    await page.goto(BASE + '/dashboard');
    const nav = page.locator('nav, .menu, .sidebar, [role="navigation"]');
    await expect(nav.first()).toBeVisible();
  });

  test('powinna wyświetlać statystyki / liczniki', async ({ page }) => {
    await page.goto(BASE + '/dashboard');
    const counts = page.locator('.count, .stat, .card, .widget, .badge');
    const visible = await counts.count();
    expect(visible).toBeGreaterThan(0);
  });

  test('powinna mieć działający tytuł strony', async ({ page }) => {
    await page.goto(BASE + '/dashboard');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('powinna reagować na różne rozmiary okna', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE + '/dashboard');
    await expect(page.locator('body')).toBeVisible();

    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
  });
});
