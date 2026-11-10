// echo's identity for the iOS project (mise run echo:ios:init).
//
// `node echo/ios/prepare.mjs template`, before `tauri ios init`: Sable's Xcode template
// (src-tauri/ios-project.yml) points at Sable's icon catalog and names Sable in the
// permission prompts. Rather than hook it, this writes a copy with echo's icon and name
// into echo/ios/build/ (gitignored), which echo/tauri.echo.ios.conf.json names as the
// template. Each swap must find its anchor, so an upstream change to the template fails
// here instead of shipping Sable's.
//
// echo's iOS icon is the Icon Composer file the Mac app also uses (echo/icons/echo.icon),
// copied in as AppIcon.icon so it is the target's AppIcon. It is full-bleed and layered;
// iOS draws its own shape and glass over it. (The PNGs the template used to get were the
// Mac's: a rounded square inset on a transparent canvas, which iOS showed with a border.)
//
// `node echo/ios/prepare.mjs icons`, after it: `tauri ios init` fills the generated
// project's own catalog with Tauri's default AppIcon set, which would clash with echo's
// AppIcon.icon by name, so this removes it.

import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../..');
const out = join(root, 'echo/ios/build');
const sableTemplate = join(root, 'src-tauri/ios-project.yml');
const generatedIconSet = join(root, 'src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset');
const echoIcon = join(root, 'echo/icons/echo.icon');

function swap(text, from, to) {
  if (!(typeof from === 'string' ? text.includes(from) : from.test(text))) {
    throw new Error(`echo/ios/prepare.mjs: ${from} not found in src-tauri/ios-project.yml`);
  }
  return text.replaceAll(from, to);
}

function writeTemplate() {
  let template = readFileSync(sableTemplate, 'utf8');
  // The project lives in src-tauri/gen/apple, so paths climb three levels to the repo.
  template = swap(
    template,
    '- path: ../../icons/ios/AppIcons.xcassets',
    '- path: ../../../echo/ios/build/AppIcon.icon'
  );
  // echo has one icon: Sable's alternate (pride) icons and their aliases stay Sable's.
  template = swap(template, /\n *# APP-ICON ALIASES START[\s\S]*?# APP-ICON ALIASES END/g, '');
  template = swap(template, /\n *ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES:[^\n]*/g, '');
  template = swap(template, /\bSable (uses|connects|shares|saves)\b/g, 'echo $1');
  template = swap(template, 'CFBundleDisplayName: Sable', 'CFBundleDisplayName: echo');
  // iPhones run portrait only: a phone on its side is wider than 48rem, which is
  // the desktop layout's breakpoint, so landscape would swap echo's phone UI
  // for the desktop's. iPads keep every orientation (they get the desktop's).
  template = swap(
    template,
    /(\n *UISupportedInterfaceOrientations:\n *- UIInterfaceOrientationPortrait)\n *- UIInterfaceOrientationLandscapeLeft\n *- UIInterfaceOrientationLandscapeRight/g,
    '$1'
  );

  rmSync(out, { recursive: true, force: true });
  cpSync(echoIcon, join(out, 'AppIcon.icon'), { recursive: true });
  writeFileSync(join(out, 'project.yml'), template);
  console.log('Wrote echo/ios/build/project.yml and AppIcon.icon');
}

const step = process.argv[2];
if (step === 'template') writeTemplate();
else if (step === 'icons') {
  rmSync(generatedIconSet, { recursive: true, force: true });
  console.log("Removed Tauri's default AppIcon set from src-tauri/gen/apple/Assets.xcassets");
} else throw new Error('usage: node echo/ios/prepare.mjs <template|icons>');
