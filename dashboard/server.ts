import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDatabaseConfigured } from './src/server/db.ts';
import { registerApiRoutes } from './src/server/routes.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carrega .env local (dashboard/.env) e herda automaticamente o .env da raiz do repositório (../.env)
for (const candidateEnv of [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
]) {
  if (fs.existsSync(candidateEnv)) {
    dotenv.config({ path: candidateEnv, override: false });
  }
}

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  registerApiRoutes(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: __dirname,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `COBIT 5 Governance Dashboard server running on http://0.0.0.0:${PORT} (DB live: ${isDatabaseConfigured()})`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
