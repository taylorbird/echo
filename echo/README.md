# echo

echo is a fork of [Sable](https://git.sable.moe/SableClient/Sable-next). Everything that makes
it echo lives in this folder, so that merging Sable's upstream stays cheap: echo changes Sable's
own files only with one-line hooks, listed below. Before adding another hook, see if the change
can live here instead.

## What's here

- `theme.css` — echo's look (palette, Inter / Fira Code) over Sable's design tokens, loaded
  right after `src/styles.css`. Outside `src/` because Sable's theme check allows literal
  colours only in `src/styles.css`.
- `branding.ts` — swaps "Sable" for "echo" in every locale bundle as it loads. Strings about
  the Sable project itself keep its name.
- `brand/logo.svg` — the in-app logo. `icons/` — native app icons, generated with
  `pnpm tauri icon /path/to/echo-icon-facet-split-squircle.png --output echo/icons`.
- `tauri.echo.conf.json` — merged over `src-tauri/tauri.conf.json` by the echo tasks: name,
  bundle ID, window, icons, update feed.

Fonts are in `static/fonts/echo/`, since that's where Vite serves static files from.

## Hooks into Sable's files

| File | Hook |
| --- | --- |
| `src/routes/+layout.svelte` | `import '../../echo/theme.css'` after `styles.css` |
| `src/lib/locales.ts` | `brandLocale(...)` around the loaded bundle |
| `src/lib/i18n.ts` | `brandLocale(en)` for the built-in English fallback |
| `src/lib/ui/SableBrandMark.svelte` | logo import points at `echo/brand/logo.svg` |

## Running

- `mise run echo:dev` — the branded app for this desktop, with live reload.
- `mise run echo:build` — a branded, unsigned build.

Plain `mise run tauri dev` still runs unbranded Sable.

## Identity and updates

Dev and test builds use the bundle ID `dev.tbird.echo.dev`, so they don't collide with an
installed echo. (Not `dev.tbird.echo-dev`: that was echo-gomuks's dev data folder.) Releases will use `dev.tbird.echo`, which the gomuks-based echo (now
[echo-gomuks](https://github.com/taylorbird/echo-gomuks)) used: installed copies of that app
check `taylorbird/echo` for updates, so **don't publish a release with a `latest.json` here until
this app can replace it.**

## Upstream

Remotes: `upstream` (Sable's GitHub mirror) and `sable-forgejo`. Merge upstream weekly: in a
replay of Sable's history, echo's layer merged cleanly across 1 to 8 weeks of upstream changes,
but files like `RoomView.svelte` and `TimelineItem.svelte` change ~100 times a month, so keep
hooks in them small and merge often. Sable doesn't accept AI-assisted contributions, so nothing
here goes upstream.
