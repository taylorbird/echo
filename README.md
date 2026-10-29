# echo

echo is a Matrix chat app for macOS.

## Install

You need a Mac with Apple Silicon (M1 or later) running macOS 12 or later.

1. Open the [latest release](https://github.com/taylorbird/echo/releases/latest).
2. Download `echo-<version>-arm64.dmg`.
3. Open the DMG and drag **echo** into **Applications**.
4. Open echo and sign in with your Matrix account.

Or install it with [Homebrew](https://brew.sh):

```sh
brew tap taylorbird/echo
brew trust --cask taylorbird/echo/echo
brew install --cask taylorbird/echo/echo
```

(`brew trust` is needed on Homebrew 7 and later, which only loads casks from taps you trust.)

echo updates itself, so you only install it once.

## About this repo

echo is a fork of [Sable](https://git.sable.moe/SableClient/Sable-next). Everything specific to
echo lives in [`echo/`](echo/README.md). Sable's original README, with build and self-hosting
instructions, is at [`echo/SABLE_README.md`](echo/SABLE_README.md).

## License

AGPL-3.0-or-later. See [`LICENSE`](LICENSE).
