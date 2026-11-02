import { afterEach, expect, test, vi } from 'vitest';
import { echoNativeRedirectUri } from './auth.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

test("signs in through the echo build's own scheme", () => {
  vi.stubGlobal('sableElectron', { echoRedirectScheme: 'com.github.taylorbird.echo.dev' });
  expect(echoNativeRedirectUri('oidc')).toBe('com.github.taylorbird.echo.dev:/login');
  expect(echoNativeRedirectUri('sso')).toBe('com.github.taylorbird.echo.dev://login');
});

test("leaves Sable's schemes to Sable outside echo's Electron app", () => {
  expect(echoNativeRedirectUri('oidc')).toBeNull();
  vi.stubGlobal('sableElectron', {});
  expect(echoNativeRedirectUri('oidc')).toBeNull();
  vi.stubGlobal('sableElectron', { echoRedirectScheme: null });
  expect(echoNativeRedirectUri('sso')).toBeNull();
});
