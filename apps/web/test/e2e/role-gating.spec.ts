import { test, expect } from '@playwright/test';

test.describe('Role Gating & Protected Routes', () => {
  test('Redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/staff/activities');
    await expect(page).toHaveURL(/.*\/login\?next=.*/);
    await expect(page.locator('h1')).toContainText('Sign In to SVC-RMS');
  });

  test('Shows Access Denied for student accessing staff routes', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student1@example.test');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await expect(page).toHaveURL('/');

    // Attempt to visit staff route
    await page.goto('/staff/activities');

    // Should see RoleGate access denied
    await expect(page.locator('text="Access Denied"')).toBeVisible();
    await expect(page.locator('text="requires one of the following roles: STAFF, ADMIN"')).toBeVisible();
  });
});
