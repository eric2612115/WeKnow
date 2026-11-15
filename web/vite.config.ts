import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// The labelled fixture set lives in web/fixtures (served as-is by the dev server). The hidden /eval page needs the
// same files after a build, so copy them next to the app; nothing else in fixtures/ is shipped this way.
function evalFixtures(): Plugin {
  let outDir = 'dist';
  return {
    name: 'weknow-eval-fixtures',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const from = resolve(__dirname, 'fixtures/eval');
      if (existsSync(from)) cpSync(from, resolve(outDir, 'fixtures/eval'), { recursive: true });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), evalFixtures()],
});
