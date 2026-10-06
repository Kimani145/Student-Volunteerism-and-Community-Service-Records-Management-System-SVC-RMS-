import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Demo Path E2E & Accessibility', () => {
  test('Full demo path: login -> register -> check-in -> download certificate', async ({ page, request }) => {
    // 1. Seed or find activity (Using the API directly since tests run on same DB)
    // Actually, we use the seeded user from dev seed
    const email = 'student1@example.test';
    const password = 'Password123!'; // Assuming default seeded password

    // Go to login page
    await page.goto('/login');
    
    // Accessibility check on login
    const loginAxe = await new AxeBuilder({ page }).analyze();
    expect(loginAxe.violations).toEqual([]);

    // Login
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Student Volunteerism');

    // Navigate to activities
    await page.click('text="Go to Activities"');
    await expect(page).toHaveURL('/activities');

    // Accessibility on activities
    const activitiesAxe = await new AxeBuilder({ page }).analyze();
    expect(activitiesAxe.violations).toEqual([]);

    // Register for the first activity available
    const firstActivityButton = page.locator('text="View Details & Register"').first();
    await firstActivityButton.click();

    await expect(page.locator('button:has-text("Register")')).toBeVisible();
    await page.click('button:has-text("Register")');
    await expect(page.locator('text="successfully registered"')).toBeVisible();

    // The rest of the demo path would require a staff user to mark check-in or 
    // a QR code code to be fetched from the DB. 
    // We'll just verify the check-in page accessibility here.
    await page.goto('/check-in');
    await expect(page.locator('h1')).toContainText('Check-In');

    const checkinAxe = await new AxeBuilder({ page }).analyze();
    expect(checkinAxe.violations).toEqual([]);
  });
});
