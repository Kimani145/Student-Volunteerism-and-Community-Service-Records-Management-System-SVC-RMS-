import { test, expect } from '@playwright/test';

test.describe('Session Reload & Error States', () => {
  test('Session persists across page reloads', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student1@example.test');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');
    
    // Reload page
    await page.reload();
    
    // Should still be on dashboard and not redirect to login
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Student Volunteerism');
  });

  test('Displays API error state correctly', async ({ page }) => {
    // We can simulate an API error by intercepting the network request
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student1@example.test');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');

    // Intercept activities request to fail
    await page.route('**/api/v1/activities*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Database connection failed'
        })
      });
    });

    await page.goto('/activities');

    // Wait for the ErrorState component to be visible
    await expect(page.locator('text="Internal Server Error"')).toBeVisible();
    await expect(page.locator('text="Database connection failed"')).toBeVisible();
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
  });
});
