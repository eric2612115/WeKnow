import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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

// The text reader that covers personal details before a picture may be sent (src/coverPicture.ts) runs from WeKnow's
// own site, never a CDN: its worker, its WebAssembly core (the LSTM-only builds; the browser picks one) and the
// English data are served at /tessdata from the npm packages in the dev server, and copied there by a build.
const TESSDATA: Record<string, string> = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'worker.min.js.LICENSE.txt': 'tesseract.js/dist/worker.min.js.LICENSE.txt',
  'core/tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'core/tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'core/tesseract-core-relaxedsimd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'eng.traineddata.gz': '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
};
function tessdata(): Plugin {
  const from = (p: string) => resolve(import.meta.dirname, 'node_modules', TESSDATA[p]);
  let outDir = 'dist';
  let isBuild = false;
  return {
    name: 'weknow-tessdata',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
      isBuild = c.command === 'build';
    },
    configureServer(server) {
      server.middlewares.use('/tessdata/', (req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').split('?')[0].replace(/^\//, ''));
        if (!(path in TESSDATA)) return next();
        res.setHeader('Content-Type', path.endsWith('.gz') ? 'application/octet-stream' : 'text/javascript');
        res.end(readFileSync(from(path)));
      });
    },
    closeBundle() {
      if (!isBuild) return;
      for (const p of Object.keys(TESSDATA)) {
        mkdirSync(dirname(resolve(outDir, 'tessdata', p)), { recursive: true });
        copyFileSync(from(p), resolve(outDir, 'tessdata', p));
      }
    },
  };
}

// The PDF reader (src/pdf.ts) also runs from WeKnow's own site: its worker is bundled as an asset by Vite (?url), and
// the font and image-decoder data it fetches on demand are served at /pdfjs from the npm package in the dev server,
// and copied there by a build.
const PDFJS_DIRS = ['standard_fonts', 'wasm'];
function pdfjsData(): Plugin {
  const root = resolve(import.meta.dirname, 'node_modules/pdfjs-dist');
  let outDir = 'dist';
  let isBuild = false;
  return {
    name: 'weknow-pdfjs-data',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
      isBuild = c.command === 'build';
    },
    configureServer(server) {
      server.middlewares.use('/pdfjs/', (req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').split('?')[0].replace(/^\//, ''));
        const [dir, file, ...more] = path.split('/');
        if (!PDFJS_DIRS.includes(dir) || !file || more.length || file.startsWith('.')) return next();
        const from = resolve(root, dir, file);
        if (!existsSync(from)) return next();
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
        res.end(readFileSync(from));
      });
    },
    closeBundle() {
      if (!isBuild) return;
      for (const d of PDFJS_DIRS) cpSync(resolve(root, d), resolve(outDir, 'pdfjs', d), { recursive: true });
    },
  };
}

// The five made-up test papers (docs/test-sheets) are offered for download on the front page, so anyone can try the
// app without the repository. Served at /test-sheets from the docs folder in the dev server, and copied there by a
// build; only the PDFs and pictures go.
function testSheets(): Plugin {
  const root = resolve(import.meta.dirname, '../docs/test-sheets');
  const shipped = (f: string) => /^[a-z0-9-]+\.(pdf|png)$/.test(f);
  let outDir = 'dist';
  let isBuild = false;
  return {
    name: 'weknow-test-sheets',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
      isBuild = c.command === 'build';
    },
    configureServer(server) {
      server.middlewares.use('/test-sheets/', (req, res, next) => {
        const file = decodeURIComponent((req.url ?? '').split('?')[0].replace(/^\//, ''));
        if (!shipped(file) || !existsSync(resolve(root, file))) return next();
        res.setHeader('Content-Type', file.endsWith('.pdf') ? 'application/pdf' : 'image/png');
        res.end(readFileSync(resolve(root, file)));
      });
    },
    closeBundle() {
      if (!isBuild || !existsSync(root)) return;
      mkdirSync(resolve(outDir, 'test-sheets'), { recursive: true });
      for (const f of readdirSync(root).filter(shipped)) copyFileSync(resolve(root, f), resolve(outDir, 'test-sheets', f));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), evalFixtures(), tessdata(), pdfjsData(), testSheets()],
  // Pre-bundle the text reader's loader up front, so its first use in the dev server does not reload the page.
  optimizeDeps: { include: ['tesseract.js'] },
  build: {
    rolldownOptions: {
      output: {
        // Firestore loads only after Start, with two self-contained helpers (its network transport and a regular
        // expression engine). Shipping those as their own chunks keeps every chunk under 500 kB. Only those two
        // packages are grouped; everything else is chunked as Vite decides.
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'firestore-transport', test: /node_modules[\\/]@firebase[\\/]webchannel-wrapper[\\/]/ },
            { name: 'firestore-regex', test: /node_modules[\\/]re2js[\\/]/ },
          ],
        },
      },
    },
  },
});
