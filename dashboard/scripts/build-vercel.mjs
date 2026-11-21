// Gera a saída no formato Build Output API v3 da Vercel (.vercel/output):
//  - static/            -> front-end (dist/ do Vite)
//  - functions/api.func -> API Express empacotada num único arquivo
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.vercel', 'output');
const funcDir = path.join(out, 'functions', 'api.func');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(funcDir, { recursive: true });

fs.cpSync(path.join(root, 'dist'), path.join(out, 'static'), { recursive: true });

await build({
  entryPoints: [path.join(root, 'vercel', 'entry.ts')],
  outfile: path.join(funcDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['pg-native'],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  logLevel: 'warning',
});

fs.copyFileSync(
  path.join(root, 'src', 'server', 'verifiedSnapshot.json'),
  path.join(funcDir, 'verifiedSnapshot.json')
);

fs.writeFileSync(
  path.join(funcDir, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: true }, null, 2)
);

fs.writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api(/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2
  )
);

console.log('Vercel output pronto em .vercel/output');
