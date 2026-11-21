import express from 'express';
import { registerApiRoutes } from '../src/server/routes.ts';

// Função serverless da Vercel: mesmas rotas /api/* do server.ts.
// DATABASE_URL vem das Environment Variables do projeto na Vercel;
// sem ela, a API responde com o snapshot verificado (verifiedSnapshot.json).
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
registerApiRoutes(app);

export default app;
