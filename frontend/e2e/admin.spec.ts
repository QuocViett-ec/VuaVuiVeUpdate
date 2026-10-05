import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/release-config.json') return route.fulfill({ json: {
      releaseSha: 'a'.repeat(40), customerPortalBase: 'https://customer-staging.example.invalid',
      adminPortalBase: 'https://admin-staging.example.invalid',
    } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, json: { success: false } });
    return route.continue();
  });
});

test('admin build boots with staging links and empty credentials; empty submit stays local', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible();
  await expect(page.getByLabel('Tài khoản (SĐT hoặc Email)')).toHaveValue('');
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('');
  await expect(page.getByRole('link', { name: 'Mở trang khách hàng' })).toHaveAttribute('href', 'https://customer-staging.example.invalid');
  await page.getByRole('button', { name: 'Đăng nhập Admin' }).click();
  await expect(page.getByText('Vui lòng điền đầy đủ thông tin.')).toBeVisible();
  expect(posts).toEqual([]);
});

test('an unauthenticated visitor cannot open the admin dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/auth\/login\?returnUrl=/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible();
});
