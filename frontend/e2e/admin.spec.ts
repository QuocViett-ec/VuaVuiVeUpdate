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

test('admin validates the original price and sends a genuine discount', async ({ page }) => {
  const user = { id: '000000000000000000000002', name: 'QA admin', role: 'admin' };
  await page.addInitScript(user => localStorage.setItem('vvv_session_v1', JSON.stringify(user)), user);
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST' && url.pathname === '/api/products') {
      submitted = route.request().postDataJSON() as Record<string, unknown>;
    }
    await route.fulfill({ json: { success: true, data: url.pathname === '/api/auth/me' ? user : [] } });
  });
  await page.goto('/products');
  await page.getByRole('button', { name: '+ Thêm sản phẩm', exact: true }).click();
  await page.locator('input[name="name"]').fill('QA discount');
  await page.locator('input[name="price"]').fill('50000');
  const originalPrice = page.getByLabel('Giá gốc trước giảm', { exact: false });
  await originalPrice.fill('40000');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Giá gốc trước giảm phải lớn hơn giá bán.')).toBeVisible();
  expect(submitted).toBeUndefined();
  await originalPrice.fill('100000');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect.poll(() => submitted?.['originalPrice']).toBe(100000);
  expect(submitted?.['price']).toBe(50000);
});
