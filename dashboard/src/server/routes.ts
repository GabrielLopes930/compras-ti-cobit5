import type { Express } from 'express';
import {
  getEnabler1Data,
  getEnabler2Data,
  getEnabler3Data,
  getEnabler4Data,
  getEnabler5Data,
  getEnabler6Data,
  getEnabler7Data,
  getFilterOptions,
  getOkrsData,
  getOverviewData,
  sanitizeFilters,
} from './queries.ts';
import { isDatabaseConfigured } from './db.ts';

/**
 * Rotas da API (somente leitura). Usadas pelo servidor local (server.ts)
 * e pela função serverless da Vercel (vercel/entry.ts).
 */
export function registerApiRoutes(app: Express): void {
  // Health & metadata check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      readOnlyEnforced: true,
      databaseConfigured: isDatabaseConfigured(),
    });
  });

  app.get('/api/filters', async (_req, res) => {
    try {
      const data = await getFilterOptions();
      res.json(data);
    } catch (err) {
      console.error('Error in /api/filters:', err);
      res.status(500).json({ error: 'Falha ao carregar opções de filtro do banco de dados.' });
    }
  });

  app.get('/api/overview', async (req, res) => {
    try {
      const filters = sanitizeFilters(req.query as Record<string, string>);
      const data = await getOverviewData(filters);
      res.json(data);
    } catch (err) {
      console.error('Error in /api/overview:', err);
      res.status(500).json({ error: 'Falha ao consultar indicadores da Visão Geral.' });
    }
  });

  app.get('/api/enabler/1', async (req, res) => {
    try {
      const filters = sanitizeFilters(req.query as Record<string, string>);
      const data = await getEnabler1Data(filters);
      res.json(data);
    } catch (err) {
      console.error('Error in /api/enabler/1:', err);
      res.status(500).json({ error: 'Falha ao consultar dados do Habilitador 1.' });
    }
  });

  app.get('/api/enabler/2', async (req, res) => {
    try {
      const filters = sanitizeFilters(req.query as Record<string, string>);
      const data = await getEnabler2Data(filters);
      res.json(data);
    } catch (err) {
      console.error('Error in /api/enabler/2:', err);
      res.status(500).json({ error: 'Falha ao consultar dados do Habilitador 2.' });
    }
  });

  app.get('/api/enabler/3', async (req, res) => {
    try {
      const filters = sanitizeFilters(req.query as Record<string, string>);
      const data = await getEnabler3Data(filters);
      res.json(data);
    } catch (err) {
      console.error('Error in /api/enabler/3:', err);
      res.status(500).json({ error: 'Falha ao consultar dados do Habilitador 3 (Tocantins).' });
    }
  });

  app.get('/api/enabler/4', async (req, res) => {
    try {
      const filters = sanitizeFilters(req.query as Record<string, string>);
      const data = await getEnabler4Data(filters);
      res.json(data);
    } catch (err) {
      console.error('Error in /api/enabler/4:', err);
      res.status(500).json({ error: 'Falha ao consultar dados do Habilitador 4.' });
    }
  });

  app.get('/api/enabler/5', async (_req, res) => {
    try {
      const data = await getEnabler5Data();
      res.json(data);
    } catch (err) {
      console.error('Error in /api/enabler/5:', err);
      res.status(500).json({ error: 'Falha ao consultar auditoria do Habilitador 5.' });
    }
  });

  app.get('/api/enabler/6', async (req, res) => {
    try {
      const filters = sanitizeFilters(req.query as Record<string, string>);
      const data = await getEnabler6Data(filters);
      res.json(data);
    } catch (err) {
      console.error('Error in /api/enabler/6:', err);
      res.status(500).json({ error: 'Falha ao consultar dados do Habilitador 6.' });
    }
  });

  app.get('/api/enabler/7', async (req, res) => {
    try {
      const filters = sanitizeFilters(req.query as Record<string, string>);
      const data = await getEnabler7Data(filters);
      res.json(data);
    } catch (err) {
      console.error('Error in /api/enabler/7:', err);
      res.status(500).json({ error: 'Falha ao consultar dados do Habilitador 7.' });
    }
  });

  app.get('/api/okrs', async (_req, res) => {
    try {
      const data = await getOkrsData();
      res.json(data);
    } catch (err) {
      console.error('Error in /api/okrs:', err);
      res.status(500).json({ error: 'Falha ao consolidar linha de base dos OKRs.' });
    }
  });
}
