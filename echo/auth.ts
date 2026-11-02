// echo's OAuth sign-in redirect in its Electron app. Each echo build declares
// only its own scheme (com.github.taylorbird.echo, or .dev/.test/… for other
// builds: echo/electron/app.ts), and the preload passes it in as
// `sableElectron.echoRedirectScheme`. Sable's nativeRedirectUri
// (src/lib/auth/redirect.ts) asks here first; Tauri builds and Sable's own
// Electron builds have no echo scheme and keep Sable's moe.sable.next.

type RedirectLoginType = 'oidc' | 'sso';

function echoRedirectScheme(): string | null {
  const bridge = (globalThis as { sableElectron?: { echoRedirectScheme?: unknown } }).sableElectron;
  const scheme = bridge?.echoRedirectScheme;
  return typeof scheme === 'string' && scheme.length > 0 ? scheme : null;
}

/**
 * The redirect the core registers and signs in with, or null outside echo's Electron app.
 * OAuth needs a private-use URI without an authority (`…:/login`); the legacy SSO form keeps
 * Sable's `…://login`.
 */
export function echoNativeRedirectUri(loginType: RedirectLoginType): string | null {
  const scheme = echoRedirectScheme();
  if (!scheme) return null;
  return loginType === 'oidc' ? `${scheme}:/login` : `${scheme}://login`;
}
