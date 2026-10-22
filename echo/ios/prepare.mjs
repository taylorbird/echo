// echo's identity for the iOS project (mise run echo:ios:init).
//
// `node echo/ios/prepare.mjs template`, before `tauri ios init`: Sable's Xcode template
// (src-tauri/ios-project.yml) points at Sable's icon catalog and names Sable in the
// permission prompts. Rather than hook it, this writes a copy with echo's icon catalog
// and name into echo/ios/build/ (gitignored), which echo/tauri.echo.ios.conf.json names
// as the template. Each swap must find its anchor, so an upstream change to the
// template fails here instead of shipping Sable's.
//
// `node echo/ios/prepare.mjs icons`, after it: `tauri ios init` fills the generated
// project's own catalog with Tauri's default icon; echo's replaces it.

import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../..');
const out = join(root, 'echo/ios/build');
const sableTemplate = join(root, 'src-tauri/ios-project.yml');
const sableIconSet = join(root, 'src-tauri/icons/ios/AppIcons.xcassets/AppIcon.appiconset');
const generatedIconSet = join(root, 'src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset');
const echoIcons = join(root, 'echo/icons/ios');

function swap(text, from, to) {
  if (!(typeof from === 'string' ? text.includes(from) : from.test(text))) {
    throw new Error(`echo/ios/prepare.mjs: ${from} not found in src-tauri/ios-project.yml`);
  }
  return text.replaceAll(from, to);
}

// echo's icons are `tauri icon` output, named as Sable's and Tauri's.
function copyEchoIcons(iconSet) {
  for (const file of readdirSync(echoIcons)) {
    if (file.endsWith('.png')) copyFileSync(join(echoIcons, file), join(iconSet, file));
  }
}

function writeTemplate() {
  let template = readFileSync(sableTemplate, 'utf8');
  // The project lives in src-tauri/gen/apple, so paths climb three levels to the repo.
  template = swap(
    template,
    '- path: ../../icons/ios/AppIcons.xcassets',
    '- path: ../../../echo/ios/build/AppIcons.xcassets'
  );
  // echo has one icon: Sable's alternate (pride) icons and their aliases stay Sable's.
  template = swap(template, /\n *# APP-ICON ALIASES START[\s\S]*?# APP-ICON ALIASES END/g, '');
  template = swap(template, /\n *ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES:[^\n]*/g, '');
  template = swap(template, /\bSable (uses|connects|shares|saves)\b/g, 'echo $1');
  template = swap(template, 'CFBundleDisplayName: Sable', 'CFBundleDisplayName: echo');

  rmSync(out, { recursive: true, force: true });
  const iconSet = join(out, 'AppIcons.xcassets/AppIcon.appiconset');
  mkdirSync(iconSet, { recursive: true });
  writeFileSync(join(out, 'project.yml'), template);
  copyFileSync(join(sableIconSet, 'Contents.json'), join(iconSet, 'Contents.json'));
  writeFileSync(
    join(out, 'AppIcons.xcassets/Contents.json'),
    `${JSON.stringify({ info: { version: 1, author: 'xcode' } }, null, 2)}\n`
  );
  copyEchoIcons(iconSet);
  console.log('Wrote echo/ios/build/project.yml and AppIcons.xcassets');
}

const step = process.argv[2];
if (step === 'template') writeTemplate();
else if (step === 'icons') {
  copyEchoIcons(generatedIconSet);
  console.log('Copied echo icons into src-tauri/gen/apple/Assets.xcassets');
} else throw new Error('usage: node echo/ios/prepare.mjs <template|icons>');
