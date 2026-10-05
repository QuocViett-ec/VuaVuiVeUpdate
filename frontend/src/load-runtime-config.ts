import { environment } from './environments/environment';

/** Public portal URLs can vary by environment while the verified JS build stays identical. */
export async function loadRuntimeConfig(): Promise<void> {
  if (!environment.production) return;
  const response = await fetch('/release-config.json', {
    cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(5000),
  });
  // Existing deployments without release-config.json retain their compiled configuration.
  if (response.status === 404 || !response.headers.get('content-type')?.includes('application/json')) return;
  if (!response.ok) throw new Error('Không tải được cấu hình ứng dụng.');
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object') throw new Error('Cấu hình ứng dụng không hợp lệ.');
  const config = value as Record<string, unknown>;
  if (typeof config['releaseSha'] !== 'string' || !/^[a-f0-9]{40}$/.test(config['releaseSha'])) {
    throw new Error('Phiên bản ứng dụng không hợp lệ.');
  }
  function portalOrigin(key: string): string {
    const input = config[key];
    if (typeof input !== 'string') throw new Error('Thiếu địa chỉ ứng dụng.');
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.origin !== input || url.username || url.password) {
      throw new Error('Địa chỉ ứng dụng không hợp lệ.');
    }
    return input;
  }
  const customerPortalBase = portalOrigin('customerPortalBase');
  const adminPortalBase = portalOrigin('adminPortalBase');
  if (customerPortalBase === adminPortalBase) throw new Error('Địa chỉ hai ứng dụng phải khác nhau.');
  const clientId = config['googleClientId'];
  if (clientId !== undefined && (typeof clientId !== 'string' || !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId))) {
    throw new Error('Google client ID không hợp lệ.');
  }
  Object.assign(environment, { customerPortalBase, adminPortalBase,
    ...(typeof clientId === 'string' ? { googleClientId: clientId } : {}),
  });
}
