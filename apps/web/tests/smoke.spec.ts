import { test, expect } from '@playwright/test';

test('home page renders ClipFlow heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ClipFlow' })).toBeVisible();
});
