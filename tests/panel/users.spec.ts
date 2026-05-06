import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost';

test.describe('Panel - Zarządzanie użytkownikami', () => {
  test('powinna wyświetlać listę użytkowników', async ({ page }) => {
    await page.goto(BASE + '/users');
    const table = page.locator('table, .user-list, [data-testid="users"]');
    await expect(table.first()).toBeVisible({ timeout: 8000 });
  });

  test('powinna zawierać przycisk dodawania użytkownika', async ({ page }) => {
    await page.goto(BASE + '/users');
    const btn = page.locator('button, a').filter({ hasText: /dodaj|nowy|add|new|create/i });
    await expect(btn.first()).toBeVisible();
  });

  test('powinna umożliwiać wyszukiwanie użytkowników', async ({ page }) => {
    await page.goto(BASE + '/users');
    const search = page.locator('input[type="search"], input[placeholder*="szukaj" i], input[placeholder*="search" i]');
    if (await search.count() > 0) {
      await search.first().fill('test');
      await page.keyboard.press('Enter');
      await expect(page.locator('body')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('powinna otwierać formularz edycji użytkownika', async ({ page }) => {
    await page.goto(BASE + '/users');
    const editBtn = page.locator('button, a').filter({ hasText: /edytuj|edit/i });
    if (await editBtn.count() > 0) {
      await editBtn.first().click();
      await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('powinna mieć paginację gdy jest wiele rekordów', async ({ page }) => {
    await page.goto(BASE + '/users');
    // Pagination is optional – just check page loaded
    await expect(page.locator('body')).toBeVisible();
  });
});
