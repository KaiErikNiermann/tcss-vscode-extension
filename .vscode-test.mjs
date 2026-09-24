import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out-e2e/**/*.e2e.cjs',
  workspaceFolder: 'test/e2e/workspace',
  // Only disables extensions installed in the test profile; the one under test still loads.
  launchArgs: ['--disable-extensions'],
  mocha: { ui: 'bdd', timeout: 30_000 },
});
