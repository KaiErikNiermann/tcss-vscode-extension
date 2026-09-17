import { rm } from 'node:fs/promises';

import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

// Stale output from an earlier layout would otherwise be packaged into the vsix.
await rm('out', { recursive: true, force: true });

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outExtension: { '.js': '.cjs' },
  sourcemap: !process.argv.includes('--minify'),
  minify: process.argv.includes('--minify'),
  logLevel: 'info',
};

const builds = [
  // The extension host loads this. `vscode` is provided by the host, never bundled.
  { ...shared, entryPoints: ['src/extension/main.ts'], outfile: 'out/extension/main.cjs', external: ['vscode'] },
  // The language server runs in its own process and has no access to the vscode API.
  { ...shared, entryPoints: ['src/language/main.ts'], outfile: 'out/language/main.cjs', external: [] },
];

if (watch) {
  await Promise.all(
    builds.map(async (options) => {
      const context = await esbuild.context(options);
      return context.watch();
    }),
  );
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)));
}
