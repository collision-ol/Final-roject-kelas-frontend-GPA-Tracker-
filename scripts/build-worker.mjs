import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(rootDir, 'dist');

const MIME_MAP = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function walkAssets(dir, assets = {}) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(distDir, full).replace(/\\/g, '/');
    if (
      rel === 'server' ||
      rel.startsWith('server/') ||
      rel === '.assetsignore'
    ) {
      continue;
    }
    const st = statSync(full);
    if (st.isDirectory()) {
      walkAssets(full, assets);
    } else if (st.isFile()) {
      const ext = extname(entry).toLowerCase();
      assets['/' + rel] = {
        mime: MIME_MAP[ext] || 'application/octet-stream',
        bytes: readFileSync(full).toString('base64'),
      };
    }
  }
  return assets;
}

const assets = walkAssets(distDir);
const dataJson = readFileSync(join(rootDir, 'data.json'), 'utf8').trim();
const engineSource = readFileSync(join(rootDir, 'src', 'engine', 'gpaEngine.js'), 'utf8')
  .replace(/^import\s+DATA\s+from\s+['"][^'"]+['"][^\n]*\n?/m, `const DATA = ${dataJson};\n`)
  .replace(/^export\s+\{\s*DATA\s*\};\s*/m, '')
  .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, '');

const workerChat = readFileSync(join(rootDir, 'worker', 'chat.mjs'), 'utf8');
const workerEntry = readFileSync(join(rootDir, 'worker', 'entry.mjs'), 'utf8');

const cfWorkerBundle = [engineSource, workerChat, workerEntry].join('\n');
const fullWorkerBundle = [`const ASSETS=${JSON.stringify(assets)};`, cfWorkerBundle].join('\n');

mkdirSync(join(distDir, 'server'), { recursive: true });
writeFileSync(join(distDir, 'server', 'index.js'), fullWorkerBundle, 'utf8');
writeFileSync(join(distDir, 'server', 'cf-worker.js'), cfWorkerBundle, 'utf8');
writeFileSync(join(distDir, '.assetsignore'), 'server/\n.assetsignore\n', 'utf8');

console.log(`Built worker bundle with ${Object.keys(assets).length} static assets.`);
