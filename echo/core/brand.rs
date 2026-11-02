// echo: the name the core gives servers for this app. Included from
// crates/sable-core/src/lib.rs with a `#[path]` line; Sable's sign-in,
// registration, pusher and media code use it in place of its own "Sable".
//
// Servers show it to people: the OAuth consent page and session lists
// ("echo on macOS"), the new device's name, the push registration's fallback
// name, and the User-Agent avatar hosts see. The core can't tell an echo build
// from plain Sable, so an unbranded `mise run tauri dev` says "echo" here too.

use url::Url;

pub(crate) const APP_NAME: &str = "echo";

/// echo's OAuth sign-in scheme: the release's, and the prefix of every dev or
/// test build's (`com.github.taylorbird.echo.dev`, `.test`, `.verify`), each
/// build declaring only its own (echo/electron/app.ts).
const SCHEME: &str = "com.github.taylorbird.echo";

/// The `client_uri` echo registers with for its own schemes. MAS requires a
/// private-use redirect scheme to start with the reversed `client_uri` host
/// (`github.com` -> `com.github`), and never fetches the page. Sable's
/// `reverse_dns_url` would make `https://echo.taylorbird.github.com` of it.
const CLIENT_URI: &str = "https://github.com/taylorbird/echo";

/// The `client_uri` for a native redirect scheme that is echo's, `None` for
/// any other (Sable's `moe.sable.next`, for Tauri builds), which keeps Sable's.
pub(crate) fn native_client_uri(scheme: &str) -> Option<Url> {
    let ours = scheme == SCHEME
        || scheme
            .strip_prefix(SCHEME)
            .is_some_and(|suffix| suffix.starts_with('.'));
    if !ours {
        return None;
    }
    Url::parse(CLIENT_URI).ok()
}

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};
    use url::Url;

    use super::native_client_uri;
    use crate::session::{client_metadata, qr_client_metadata};

    const SCHEMES: [&str; 4] = [
        "com.github.taylorbird.echo",
        "com.github.taylorbird.echo.dev",
        "com.github.taylorbird.echo.test",
        "com.github.taylorbird.echo.verify",
    ];

    fn metadata_json(raw: &matrix_sdk::ruma::serde::Raw<impl Sized>) -> Value {
        serde_json::from_str(raw.json().get()).unwrap()
    }

    /// MAS's `reverse_dns_match` (policies/client_registration): the scheme's
    /// labels start with the host's labels reversed.
    fn reverse_dns_match(host: &str, scheme: &str) -> bool {
        let reversed: Vec<&str> = host.split('.').rev().collect();
        let labels: Vec<&str> = scheme.split('.').collect();
        labels.len() >= reversed.len() && labels[..reversed.len()] == reversed[..]
    }

    #[test]
    fn echo_schemes_register_as_native_clients_of_the_repository() {
        for scheme in SCHEMES {
            let redirect = Url::parse(&format!("{scheme}:/login")).unwrap();
            let metadata = metadata_json(&client_metadata(&redirect));
            assert_eq!(metadata["application_type"], "native", "{scheme}");
            assert_eq!(
                metadata["client_uri"], "https://github.com/taylorbird/echo",
                "{scheme}"
            );
            assert_eq!(metadata["client_name"], "echo", "{scheme}");
            assert_eq!(
                metadata["redirect_uris"],
                json!([format!("{scheme}:/login")]),
                "{scheme}"
            );

            let qr = metadata_json(&qr_client_metadata(&redirect));
            assert_eq!(qr["client_uri"], metadata["client_uri"], "{scheme}");
            assert_eq!(qr["redirect_uris"], metadata["redirect_uris"], "{scheme}");
        }
    }

    #[test]
    fn echo_schemes_pass_the_servers_reverse_dns_rule() {
        for scheme in SCHEMES {
            let client_uri = native_client_uri(scheme).unwrap();
            let redirect = Url::parse(&format!("{scheme}:/login")).unwrap();
            assert!(redirect.host_str().is_none_or(str::is_empty), "{scheme}");
            assert!(
                reverse_dns_match(client_uri.host_str().unwrap(), scheme),
                "{scheme}"
            );
        }
        assert!(!reverse_dns_match("github.com", "moe.sable.next"));
    }

    #[test]
    fn other_schemes_keep_sables_client_uri() {
        assert_eq!(native_client_uri("moe.sable.next"), None);
        assert_eq!(native_client_uri("com.github.taylorbird.echoes"), None);
        assert_eq!(native_client_uri("com.github.taylorbird"), None);

        let next = Url::parse("moe.sable.next:/login").unwrap();
        let metadata = metadata_json(&client_metadata(&next));
        assert_eq!(metadata["application_type"], "native");
        assert_eq!(metadata["client_uri"], "https://next.sable.moe/");
    }
}
