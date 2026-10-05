import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const product = { id: '000000000000000000000001', _id: '000000000000000000000001', name: 'QA product', price: 50000, stock: 5, category: 'veg', cat: 'veg', sub: 'all', img: '/images/brand/LogoVVV.png', isActive: true };
const user = { id: '000000000000000000000002', _id: '000000000000000000000002', name: 'QA fixture', phone: '0900000000', email: '', address: 'quận 1', role: 'user' };

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T03:00:00Z'));
  await page.addInitScript(({ product, user }) => {
    localStorage.setItem('vvv_session_v1', JSON.stringify(user));
    localStorage.setItem('vvv_cart', JSON.stringify([{ product, quantity: 1 }]));
  }, { product, user });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let data: unknown = {};
    if (url.pathname === '/api/auth/me') data = user;
    else if (url.pathname.startsWith('/api/cart/')) data = { items: [{ productId: product.id, product, quantity: 1 }], savedForLater: [] };
    else if (url.pathname === '/api/products') data = [product];
    else if (url.pathname === `/api/products/${product.id}`) data = product;
    else if (url.pathname === '/api/orders/voucher/available') data = [];
    else if (url.pathname === '/api/orders/me') data = [];
    else if (url.pathname === '/api/orders' && route.request().method() === 'POST') {
      data = { orderId: 'ORD-QA', totalAmount: 65000, payment: { method: 'cod', status: 'pending' } };
    }
    await route.fulfill({ json: { success: true, data } });
  });
});

test('checkout offers COD and hides inactive gateways', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByRole('radio', { name: 'Thanh toán khi nhận hàng' })).toBeChecked();
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect(page.getByText('VNPay (thẻ ATM/QR)', { exact: true })).toHaveCount(0);
  await expect(page.getByText('MoMo', { exact: true })).toHaveCount(0);
});

test('the same build boots with staging portal configuration and keeps gateways inactive', async ({ page }) => {
  await page.route('**/release-config.json', route => route.fulfill({ json: {
    releaseSha: 'a'.repeat(40), customerPortalBase: 'https://customer-staging.example.invalid',
    adminPortalBase: 'https://admin-staging.example.invalid', onlinePayments: { momo: true, vnpay: true },
  } }));
  await page.goto('/checkout');
  await expect(page.getByRole('radio', { name: 'Thanh toán khi nhận hàng' })).toBeChecked();
  await expect(page.getByRole('radio')).toHaveCount(1);
});

test('invalid runtime portal URLs prevent application startup', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/release-config.json', route => route.fulfill({ json: {
    releaseSha: 'a'.repeat(40), customerPortalBase: 'http://insecure.example.invalid',
    adminPortalBase: 'https://admin-staging.example.invalid',
  } }));
  await page.goto('/checkout');
  await expect.poll(() => errors.some(message => message.includes('Địa chỉ ứng dụng không hợp lệ'))).toBe(true);
  await expect(page.locator('app-root')).toBeEmpty();
});

test('COD submission includes a stable idempotency key and navigates to orders', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByRole('button', { name: 'Đặt hàng', exact: true })).toBeEnabled();
  await page.getByLabel('Khung giờ giao hàng').selectOption({ index: 1 });
  const submitted = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/orders' && request.method() === 'POST');
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  const request = await submitted;
  expect(request.headers()['idempotency-key']).toMatch(/^[a-f0-9-]{36}$/);
  expect(request.postDataJSON().payment).toEqual({ method: 'cod', status: 'pending' });
  await expect(page).toHaveURL(/\/orders$/);
});

test('checkout form meets WCAG AA automated checks', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByRole('radio')).toHaveCount(1);
  const result = await new AxeBuilder({ page }).include('.co-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('checkout remains usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/checkout');
  await expect(page.getByRole('radio', { name: 'Thanh toán khi nhận hàng' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đặt hàng', exact: true })).toBeVisible();
});

test('retry after reload keeps the same key without storing delivery details', async ({ page }) => {
  const keys: string[] = [];
  await page.route('**/api/orders', async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    await route.fulfill({ status: keys.length === 1 ? 500 : 201, json: keys.length === 1
      ? { success: false, message: 'Synthetic retry failure' }
      : { success: true, data: { orderId: 'ORD-QA', payment: { method: 'cod', status: 'pending' } } } });
  });
  await page.goto('/checkout');
  await page.getByLabel('Khung giờ giao hàng').selectOption({ index: 1 });
  const failure = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/orders' && response.status() === 500);
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await failure;
  await expect(page.getByRole('button', { name: 'Đặt hàng', exact: true })).toBeEnabled();
  const stored = await page.evaluate(() => sessionStorage.getItem('vvv_checkout_attempt'));
  expect(JSON.parse(stored || '{}')).toEqual({ fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), key: keys[0] });
  await page.reload();
  await page.getByLabel('Khung giờ giao hàng').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Đặt hàng', exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});

test('catalog shows zero sales and no reviews for an unrated product', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByText('Chưa có đánh giá', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Đã bán 0', { exact: true }).first()).toBeVisible();
});
