// echo's electron-builder config: Sable's base config (electron/electron-builder.yml) with only
// this build's own sign-in scheme, in place of the nightly config's moe.sable.next. build.sh picks
// it through SABLE_BUILDER_CONFIG (electron/package.mjs) and passes everything else as -c
// overrides. electron-builder loads a .ts config with jiti, so the scheme comes from the same
// mapping the app uses (app.ts), for the identifier build.sh exports.

import { echoSchemeFor } from './app';

const identifier = process.env.SABLE_IDENTIFIER ?? '';
const scheme = echoSchemeFor(identifier);
if (!scheme) throw new Error(`no echo sign-in scheme for identifier "${identifier}"`);

export default {
  // Resolved against electron/, the project folder.
  extends: 'file:./electron-builder.yml',
  protocols: [{ name: 'echo', schemes: [scheme] }],
};
