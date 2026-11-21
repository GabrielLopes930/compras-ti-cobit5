import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cachedCompute, isDatabaseConfigured, queryReadOnly } from './db.ts';
import type {
  DashboardFilters,
  Enabler1Data,
  Enabler2Data,
  Enabler3Data,
  Enabler4Data,
  Enabler5Data,
  Enabler6Data,
  Enabler7Data,
  FilterOptionsResponse,
  OkrsData,
  OverviewData,
} from '../types/dashboard.ts';

interface VerifiedSnapshotBundle {
  generatedAt: string;
  filters: FilterOptionsResponse;
  overview: OverviewData;
  enabler1: Enabler1Data;
  enabler2: Enabler2Data;
  enabler3: Enabler3Data;
  enabler4: Enabler4Data;
  enabler5: Enabler5Data;
  enabler6: Enabler6Data;
  enabler7: Enabler7Data;
  okrs: OkrsData;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let cachedSnapshot: VerifiedSnapshotBundle | null = null;

function loadVerifiedSnapshot(): VerifiedSnapshotBundle | null {
  if (cachedSnapshot) return cachedSnapshot;
  try {
    const snapshotPath = path.resolve(__dirname, 'verifiedSnapshot.json');
    if (fs.existsSync(snapshotPath)) {
      const raw = fs.readFileSync(snapshotPath, 'utf-8');
      cachedSnapshot = JSON.parse(raw) as VerifiedSnapshotBundle;
      return cachedSnapshot;
    }
  } catch {
    return null;
  }
  return null;
}

export function sanitizeFilters(raw: Partial<DashboardFilters>): DashboardFilters {
  const mes = typeof raw.mes === 'string' && /^2025-(0[1-9]|1[0-2])$/.test(raw.mes) ? raw.mes : '';
  const modalidade =
    typeof raw.modalidade === 'string' && raw.modalidade.trim().length <= 80
      ? raw.modalidade.trim()
      : '';
  const orgao =
    typeof raw.orgao === 'string' && raw.orgao.trim().length <= 180 ? raw.orgao.trim() : '';
  const tipoItem =
    raw.tipoItem === 'Material' || raw.tipoItem === 'Serviço' ? raw.tipoItem : '';
  return { mes, modalidade, orgao, tipoItem };
}

function buildItemWhereClause(
  filters: DashboardFilters,
  alias = '',
  extraConditions: string[] = []
): { whereSql: string; params: unknown[] } {
  const p = alias ? `${alias}.` : '';
  const clauses: string[] = [`${p}ano_inclusao = 2025`, ...extraConditions];
  const params: unknown[] = [];

  if (filters.mes) {
    params.push(filters.mes);
    clauses.push(`${p}mes_inclusao = $${params.length}`);
  }
  if (filters.modalidade) {
    params.push(filters.modalidade);
    clauses.push(`${p}modalidade_nome = $${params.length}`);
  }
  if (filters.orgao) {
    params.push(filters.orgao);
    clauses.push(`${p}orgao_razao_social = $${params.length}`);
  }
  if (filters.tipoItem) {
    params.push(filters.tipoItem);
    clauses.push(`${p}material_ou_servico_nome = $${params.length}`);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const MONTH_SHORT: Record<string, string> = {
  '2025-01': 'Jan',
  '2025-02': 'Fev',
  '2025-03': 'Mar',
  '2025-04': 'Abr',
  '2025-05': 'Mai',
  '2025-06': 'Jun',
  '2025-07': 'Jul',
  '2025-08': 'Ago',
  '2025-09': 'Set',
  '2025-10': 'Out',
  '2025-11': 'Nov',
  '2025-12': 'Dez',
};

const PUBLIC_TECH_PATTERNS = ['SERPRO', 'DATAPREV', 'TELEBRAS', 'PRODESP', 'CELEPAR', 'PROCERGS'];

function isPublicTechSupplier(name: string): boolean {
  const upper = (name || '').toUpperCase();
  return PUBLIC_TECH_PATTERNS.some((p) => upper.includes(p));
}

function isClassificationAnomalySupplier(name: string): boolean {
  const upper = (name || '').toUpperCase();
  return upper.includes('CRISTALIA') || upper.includes('FARMACEUTIC');
}

function normalizeCatalogTitle(raw: string): string {
  if (!raw) return 'Não especificado';
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const lower = cleaned.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

async function withLiveOrSnapshot<T>(
  cacheKey: string,
  liveLoader: () => Promise<T>,
  snapshotSelector: (snap: VerifiedSnapshotBundle) => T
): Promise<T> {
  if (isDatabaseConfigured()) {
    try {
      return await cachedCompute(`live:${cacheKey}`, liveLoader);
    } catch (err) {
      const snap = loadVerifiedSnapshot();
      if (snap) {
        return snapshotSelector(snap);
      }
      throw err;
    }
  }
  const snap = loadVerifiedSnapshot();
  if (snap) {
    return snapshotSelector(snap);
  }
  throw new Error(
    'DATABASE_URL não configurada no servidor. Configure a variável de ambiente DATABASE_URL com acesso somente leitura ao PostgreSQL.'
  );
}

export async function getFilterOptions(): Promise<FilterOptionsResponse> {
  return withLiveOrSnapshot<FilterOptionsResponse>(
    'filter-options',
    async () => {
      const [monthsRows, modRows, orgRows, typeRows] = await Promise.all([
        queryReadOnly<{ mes_inclusao: string; cnt: string }>(
          `SELECT mes_inclusao, COUNT(*) AS cnt
           FROM vw_itens_ti_federal
           WHERE ano_inclusao = 2025 AND mes_inclusao IS NOT NULL
           GROUP BY mes_inclusao
           ORDER BY mes_inclusao`
        ),
        queryReadOnly<{ modalidade_nome: string; cnt: string }>(
          `SELECT modalidade_nome, COUNT(*) AS cnt
           FROM vw_itens_ti_federal
           WHERE ano_inclusao = 2025 AND modalidade_nome IS NOT NULL
           GROUP BY modalidade_nome
           ORDER BY COUNT(*) DESC`
        ),
        queryReadOnly<{ orgao_razao_social: string; cnt: string }>(
          `SELECT orgao_razao_social, COUNT(*) AS cnt
           FROM vw_itens_ti_federal
           WHERE ano_inclusao = 2025 AND orgao_razao_social IS NOT NULL
           GROUP BY orgao_razao_social
           ORDER BY COUNT(*) DESC
           LIMIT 350`
        ),
        queryReadOnly<{ material_ou_servico_nome: string; cnt: string }>(
          `SELECT material_ou_servico_nome, COUNT(*) AS cnt
           FROM vw_itens_ti_federal
           WHERE ano_inclusao = 2025 AND material_ou_servico_nome IS NOT NULL
           GROUP BY material_ou_servico_nome
           ORDER BY COUNT(*) DESC`
        ),
      ]);

      return {
        months: monthsRows.map((r) => ({
          value: r.mes_inclusao,
          label: `${MONTH_SHORT[r.mes_inclusao] ?? r.mes_inclusao}/2025`,
          count: num(r.cnt),
        })),
        modalities: modRows.map((r) => ({
          value: r.modalidade_nome,
          label: r.modalidade_nome,
          count: num(r.cnt),
        })),
        organs: orgRows.map((r) => ({
          value: r.orgao_razao_social,
          label: r.orgao_razao_social,
          count: num(r.cnt),
        })),
        itemTypes: typeRows.map((r) => ({
          value: r.material_ou_servico_nome,
          label: r.material_ou_servico_nome,
          count: num(r.cnt),
        })),
        dataSource: 'live_postgres',
      };
    },
    (snap) => ({
      ...snap.filters,
      dataSource: 'verified_snapshot',
      snapshotGeneratedAt: snap.generatedAt,
    })
  );
}

export async function getOverviewData(filters: DashboardFilters): Promise<OverviewData> {
  return withLiveOrSnapshot(
    `overview:${JSON.stringify(filters)}`,
    async () => {
      const { whereSql, params } = buildItemWhereClause(filters);
      // Monthly evolution respects modalidade/orgao/tipoItem so the full 12-month bar chart remains comparable
      const monthlyFilters: DashboardFilters = { ...filters, mes: '' };
      const monthlyWhere = buildItemWhereClause(monthlyFilters);

      const [kpiRows, monthlyRows, mixRows] = await Promise.all([
        queryReadOnly(
          `SELECT
             COUNT(*) AS total_itens,
             COUNT(DISTINCT id_compra) AS total_contratacoes,
             COALESCE(SUM(valor_total), 0) AS valor_estimado,
             COALESCE(SUM(valor_total_resultado), 0) AS valor_homologado,
             COUNT(*) FILTER (
               WHERE tem_resultado = 1 AND valor_total > 0
                 AND valor_total_resultado BETWEEN valor_total * 0.01 AND valor_total * 2.0
             ) AS pares_validos,
             AVG((valor_total - valor_total_resultado) / valor_total * 100.0) FILTER (
               WHERE tem_resultado = 1 AND valor_total > 0
                 AND valor_total_resultado BETWEEN valor_total * 0.01 AND valor_total * 2.0
             ) AS economia_media,
             (
               SUM(valor_total - valor_total_resultado) FILTER (
                 WHERE tem_resultado = 1 AND valor_total > 0
                   AND valor_total_resultado BETWEEN valor_total * 0.01 AND valor_total * 2.0
               ) / NULLIF(
                 SUM(valor_total) FILTER (
                   WHERE tem_resultado = 1 AND valor_total > 0
                     AND valor_total_resultado BETWEEN valor_total * 0.01 AND valor_total * 2.0
                 ), 0
               ) * 100.0
             ) AS economia_ponderada
           FROM vw_itens_ti_federal
           ${whereSql}`,
          params
        ),
        queryReadOnly(
          `SELECT
             mes_inclusao,
             COUNT(*) AS total_itens,
             COUNT(DISTINCT id_compra) AS total_contratacoes,
             COALESCE(SUM(valor_total), 0) AS valor_estimado,
             COALESCE(SUM(valor_total_resultado), 0) AS valor_homologado
           FROM vw_itens_ti_federal
           ${monthlyWhere.whereSql}
           GROUP BY mes_inclusao
           ORDER BY mes_inclusao`,
          monthlyWhere.params
        ),
        queryReadOnly(
          `SELECT
             material_ou_servico_nome AS tipo,
             COUNT(*) AS itens,
             COALESCE(SUM(valor_total), 0) AS valor_estimado,
             COALESCE(SUM(valor_total_resultado), 0) AS valor_homologado
           FROM vw_itens_ti_federal
           ${whereSql}
           GROUP BY material_ou_servico_nome
           ORDER BY valor_estimado DESC`,
          params
        ),
      ]);

      const k = kpiRows[0] ?? {};
      const maxEst = Math.max(...monthlyRows.map((r) => num(r.valor_estimado)), 0);

      const totalMixValor = mixRows.reduce((acc, r) => acc + num(r.valor_estimado), 0);
      const totalMixItens = mixRows.reduce((acc, r) => acc + num(r.itens), 0);

      return {
        kpis: {
          totalItens: num(k.total_itens),
          totalContratacoes: num(k.total_contratacoes),
          valorEstimado: num(k.valor_estimado),
          valorHomologado: num(k.valor_homologado),
          economiaMediaGlobal: num(k.economia_media),
          economiaPonderadaGlobal: num(k.economia_ponderada),
          paresValidosEconomia: num(k.pares_validos),
        },
        monthlyEvolution: monthlyRows.map((r) => {
          const valEst = num(r.valor_estimado);
          return {
            mes: String(r.mes_inclusao),
            label: MONTH_SHORT[String(r.mes_inclusao)] ?? String(r.mes_inclusao),
            valorEstimado: valEst,
            valorHomologado: num(r.valor_homologado),
            totalItens: num(r.total_itens),
            totalContratacoes: num(r.total_contratacoes),
            isPeak: maxEst > 0 && valEst === maxEst,
          };
        }),
        mixTipoItem: mixRows.map((r) => {
          const val = num(r.valor_estimado);
          const its = num(r.itens);
          return {
            tipo: String(r.tipo || 'Outros'),
            itens: its,
            valorEstimado: val,
            valorHomologado: num(r.valor_homologado),
            pctValor: totalMixValor > 0 ? (val / totalMixValor) * 100 : 0,
            pctItens: totalMixItens > 0 ? (its / totalMixItens) * 100 : 0,
          };
        }),
      };
    },
    (snap) => snap.overview
  );
}

export async function getEnabler1Data(filters: DashboardFilters): Promise<Enabler1Data> {
  return withLiveOrSnapshot(
    `enabler1:${JSON.stringify(filters)}`,
    async () => {
      const { whereSql, params } = buildItemWhereClause(filters);

      const [groupRows, modRows] = await Promise.all([
        queryReadOnly(
          `SELECT
             CASE
               WHEN tipo_contratacao = 'Com Competição' THEN 'Com Competição'
               ELSE 'Contratação Direta'
             END AS grupo,
             COALESCE(SUM(valor_total), 0) AS valor_estimado,
             COALESCE(SUM(valor_total_resultado), 0) AS valor_homologado,
             COUNT(DISTINCT id_compra) AS qtd_contratacoes,
             COUNT(*) AS qtd_itens
           FROM vw_itens_ti_federal
           ${whereSql}
           GROUP BY 1
           ORDER BY valor_estimado DESC`,
          params
        ),
        queryReadOnly(
          `SELECT
             modalidade_nome AS modalidade,
             tipo_contratacao,
             COALESCE(SUM(valor_total), 0) AS valor_estimado,
             COALESCE(SUM(valor_total_resultado), 0) AS valor_homologado,
             COUNT(DISTINCT id_compra) AS qtd_contratacoes,
             COUNT(*) AS qtd_itens
           FROM vw_itens_ti_federal
           ${whereSql}
           GROUP BY modalidade_nome, tipo_contratacao
           ORDER BY valor_estimado DESC`,
          params
        ),
      ]);

      const totalValor = groupRows.reduce((s, r) => s + num(r.valor_estimado), 0);
      const totalCont = groupRows.reduce((s, r) => s + num(r.qtd_contratacoes), 0);

      const comparison = groupRows.map((r) => {
        const val = num(r.valor_estimado);
        const cnt = num(r.qtd_contratacoes);
        return {
          grupo: (r.grupo === 'Com Competição'
            ? 'Com Competição'
            : 'Contratação Direta') as 'Com Competição' | 'Contratação Direta',
          valorEstimado: val,
          valorHomologado: num(r.valor_homologado),
          qtdContratacoes: cnt,
          qtdItens: num(r.qtd_itens),
          pctValor: totalValor > 0 ? (val / totalValor) * 100 : 0,
          pctContratacoes: totalCont > 0 ? (cnt / totalCont) * 100 : 0,
        };
      });

      const direta = comparison.find((c) => c.grupo === 'Contratação Direta');
      const comp = comparison.find((c) => c.grupo === 'Com Competição');

      return {
        comparison,
        byModality: modRows.map((r) => {
          const val = num(r.valor_estimado);
          const cnt = num(r.qtd_contratacoes);
          return {
            modalidade: String(r.modalidade || 'Não informado'),
            tipoContratacao: String(r.tipo_contratacao || 'Contratação Direta'),
            valorEstimado: val,
            valorHomologado: num(r.valor_homologado),
            qtdContratacoes: cnt,
            qtdItens: num(r.qtd_itens),
            pctValor: totalValor > 0 ? (val / totalValor) * 100 : 0,
            pctContratacoes: totalCont > 0 ? (cnt / totalCont) * 100 : 0,
          };
        }),
        summary: {
          pctDiretaValor: direta?.pctValor ?? 0,
          pctDiretaContratacoes: direta?.pctContratacoes ?? 0,
          pctCompetitivaValor: comp?.pctValor ?? 0,
          pctCompetitivaContratacoes: comp?.pctContratacoes ?? 0,
        },
      };
    },
    (snap) => snap.enabler1
  );
}

export async function getEnabler2Data(filters: DashboardFilters): Promise<Enabler2Data> {
  return withLiveOrSnapshot(
    `enabler2:${JSON.stringify(filters)}`,
    async () => {
      const { whereSql, params } = buildItemWhereClause(filters);

      const [savingsRows, outcomeRows] = await Promise.all([
        queryReadOnly(
          `SELECT
             modalidade_nome AS modalidade,
             tipo_contratacao,
             COUNT(*) AS pares_validos,
             AVG((valor_total - valor_total_resultado) / valor_total * 100.0) AS economia_media,
             (SUM(valor_total - valor_total_resultado) / NULLIF(SUM(valor_total), 0) * 100.0) AS economia_ponderada,
             COALESCE(SUM(valor_total), 0) AS valor_estimado_pares,
             COALESCE(SUM(valor_total_resultado), 0) AS valor_homologado_pares
           FROM vw_itens_ti_federal
           ${whereSql}
             AND tem_resultado = 1
             AND valor_total > 0
             AND valor_total_resultado BETWEEN valor_total * 0.01 AND valor_total * 2.0
           GROUP BY modalidade_nome, tipo_contratacao
           ORDER BY pares_validos DESC`,
          params
        ),
        queryReadOnly(
          `SELECT
             COALESCE(situacao_compra_item_nome, 'Não informada') AS situacao,
             MAX(flag_fracasso_deserto_cancelado) AS is_retrabalho,
             COUNT(*) AS quantidade
           FROM vw_itens_ti_federal
           ${whereSql}
           GROUP BY situacao_compra_item_nome
           ORDER BY quantidade DESC`,
          params
        ),
      ]);

      const totalItens = outcomeRows.reduce((s, r) => s + num(r.quantidade), 0);
      const totalRetrabalho = outcomeRows
        .filter((r) => num(r.is_retrabalho) === 1)
        .reduce((s, r) => s + num(r.quantidade), 0);
      const totalHomologado = outcomeRows
        .filter((r) => String(r.situacao).toLowerCase().includes('homolog'))
        .reduce((s, r) => s + num(r.quantidade), 0);

      const savingsByModality = savingsRows.map((r) => ({
        modalidade: String(r.modalidade),
        tipoContratacao: String(r.tipo_contratacao),
        paresValidos: num(r.pares_validos),
        economiaMedia: num(r.economia_media),
        economiaPonderada: num(r.economia_ponderada),
        valorEstimadoPares: num(r.valor_estimado_pares),
        valorHomologadoPares: num(r.valor_homologado_pares),
      }));

      const findEcon = (substr: string) =>
        savingsByModality.find((m) => m.modalidade.toLowerCase().includes(substr))?.economiaMedia ??
        0;

      return {
        savingsByModality,
        itemOutcomes: outcomeRows.map((r) => {
          const q = num(r.quantidade);
          return {
            situacao: String(r.situacao),
            quantidade: q,
            percentual: totalItens > 0 ? (q / totalItens) * 100 : 0,
            isRetrabalho: num(r.is_retrabalho) === 1,
          };
        }),
        summary: {
          taxaSucessoHomologacao: totalItens > 0 ? (totalHomologado / totalItens) * 100 : 0,
          taxaRetrabalho: totalItens > 0 ? (totalRetrabalho / totalItens) * 100 : 0,
          totalRetrabalho,
          totalItens,
          economiaPregao: findEcon('pregão'),
          economiaDispensa: findEcon('dispensa'),
          economiaInexigibilidade: findEcon('inexigib'),
        },
      };
    },
    (snap) => snap.enabler2
  );
}

export async function getEnabler3Data(filters: DashboardFilters): Promise<Enabler3Data> {
  return withLiveOrSnapshot(
    `enabler3:${JSON.stringify(filters)}`,
    async () => {
      const toWhere = buildItemWhereClause(filters, '', ["uf = 'TO'"]);
      const natWhere = buildItemWhereClause(filters);

      const [toKpiRows, natTicketRows, toOrgRows, pcaRows] = await Promise.all([
        queryReadOnly(
          `SELECT
             COUNT(DISTINCT id_compra) AS compras_to,
             COUNT(*) AS itens_to,
             COUNT(DISTINCT CASE WHEN tipo_contratacao = 'Contratação Direta' THEN id_compra END) AS diretas_to,
             COALESCE(SUM(valor_total), 0) AS est_to,
             COALESCE(SUM(valor_total_resultado), 0) AS hom_to,
             AVG((valor_total - valor_total_resultado) / valor_total * 100.0) FILTER (
               WHERE tem_resultado = 1 AND valor_total > 0
                 AND valor_total_resultado BETWEEN valor_total * 0.01 AND valor_total * 2.0
             ) AS econ_media_to,
             (
               SUM(valor_total - valor_total_resultado) FILTER (
                 WHERE tem_resultado = 1 AND valor_total > 0
                   AND valor_total_resultado BETWEEN valor_total * 0.01 AND valor_total * 2.0
               ) / NULLIF(
                 SUM(valor_total) FILTER (
                   WHERE tem_resultado = 1 AND valor_total > 0
                     AND valor_total_resultado BETWEEN valor_total * 0.01 AND valor_total * 2.0
                 ), 0
               ) * 100.0
             ) AS econ_pond_to
           FROM vw_itens_ti_federal
           ${toWhere.whereSql}`,
          toWhere.params
        ),
        queryReadOnly(
          `SELECT
             COALESCE(SUM(valor_total), 0) / NULLIF(COUNT(DISTINCT id_compra), 0) AS ticket_medio_nacional
           FROM vw_itens_ti_federal
           ${natWhere.whereSql}`,
          natWhere.params
        ),
        queryReadOnly(
          `SELECT
             orgao_razao_social AS orgao,
             COUNT(DISTINCT id_compra) AS compras,
             COUNT(DISTINCT CASE WHEN tipo_contratacao = 'Contratação Direta' THEN id_compra END) AS diretas,
             COALESCE(SUM(valor_total), 0) AS valor_estimado,
             COALESCE(SUM(valor_total_resultado), 0) AS valor_homologado
           FROM vw_itens_ti_federal
           ${toWhere.whereSql}
           GROUP BY orgao_razao_social
           ORDER BY compras DESC, valor_estimado DESC
           LIMIT 12`,
          toWhere.params
        ),
        queryReadOnly(
          `SELECT
             COUNT(*) AS total_registros,
             COALESCE(SUM(valor_total_item), 0) AS valor_planejado,
             COUNT(DISTINCT orgao) AS orgaos_pca
           FROM fato_pca_to`
        ),
      ]);

      const k = toKpiRows[0] ?? {};
      const comprasTO = num(k.compras_to);
      const diretasTO = num(k.diretas_to);
      const estTO = num(k.est_to);
      const pca = pcaRows[0] ?? {};
      const pcaCount = num(pca.total_registros);

      return {
        kpis: {
          totalContratacoesTO: comprasTO,
          totalItensTO: num(k.itens_to),
          pctDiretasTO: comprasTO > 0 ? (diretasTO / comprasTO) * 100 : 0,
          qtdDiretasTO: diretasTO,
          economiaMediaTO: num(k.econ_media_to),
          economiaPonderadaTO: num(k.econ_pond_to),
          valorEstimadoTO: estTO,
          valorHomologadoTO: num(k.hom_to),
          ticketMedioTO: comprasTO > 0 ? estTO / comprasTO : 0,
          ticketMedioNacional: num(natTicketRows[0]?.ticket_medio_nacional),
        },
        topOrgaosTO: toOrgRows.map((r) => {
          const compras = num(r.compras);
          const diretas = num(r.diretas);
          return {
            orgao: String(r.orgao),
            compras,
            comprasDiretas: diretas,
            comprasCompetitivas: Math.max(compras - diretas, 0),
            pctDiretas: compras > 0 ? (diretas / compras) * 100 : 0,
            valorEstimado: num(r.valor_estimado),
            valorHomologado: num(r.valor_homologado),
          };
        }),
        pcaStatus: {
          totalRegistros: pcaCount,
          disponivel: pcaCount > 0,
          valorPlanejadoTotal: num(pca.valor_planejado),
          orgaosComPca: num(pca.orgaos_pca),
        },
      };
    },
    (snap) => snap.enabler3
  );
}

export async function getEnabler4Data(filters: DashboardFilters): Promise<Enabler4Data> {
  return withLiveOrSnapshot(
    `enabler4:${JSON.stringify(filters)}`,
    async () => {
      const supWhere = buildItemWhereClause(filters, '', [
        'tem_resultado = 1',
        'valor_total_resultado > 0',
        'nome_fornecedor IS NOT NULL',
      ]);

      // Build filter for vw_dispensas_federal (mes_publicacao, orgao_razao_social)
      const dispClauses: string[] = ['ano_compra = 2025', 'pct_limite_dispensa IS NOT NULL'];
      const dispParams: unknown[] = [];
      if (filters.mes) {
        dispParams.push(filters.mes);
        dispClauses.push(`mes_publicacao = $${dispParams.length}`);
      }
      if (filters.orgao) {
        dispParams.push(filters.orgao);
        dispClauses.push(`orgao_razao_social = $${dispParams.length}`);
      }
      const dispWhereSql = `WHERE ${dispClauses.join(' AND ')}`;

      const [supTotalsRows, top10Rows, histRows] = await Promise.all([
        queryReadOnly(
          `SELECT
             COUNT(DISTINCT nome_fornecedor) AS total_fornecedores,
             COALESCE(SUM(valor_total_resultado), 0) AS total_homologado
           FROM vw_itens_ti_federal
           ${supWhere.whereSql}`,
          supWhere.params
        ),
        queryReadOnly(
          `SELECT
             nome_fornecedor,
             COUNT(*) AS itens,
             COALESCE(SUM(valor_total_resultado), 0) AS valor_homologado
           FROM vw_itens_ti_federal
           ${supWhere.whereSql}
           GROUP BY nome_fornecedor
           ORDER BY valor_homologado DESC
           LIMIT 10`,
          supWhere.params
        ),
        queryReadOnly(
          `SELECT
             CASE
               WHEN pct_limite_dispensa < 20 THEN '0–20%'
               WHEN pct_limite_dispensa < 40 THEN '20–40%'
               WHEN pct_limite_dispensa < 60 THEN '40–60%'
               WHEN pct_limite_dispensa < 80 THEN '60–80%'
               WHEN pct_limite_dispensa < 90 THEN '80–90%'
               WHEN pct_limite_dispensa <= 100 THEN '90–100%'
               ELSE 'Acima do teto'
             END AS faixa,
             COUNT(*) AS quantidade,
             COALESCE(SUM(valor_total_estimado), 0) AS valor_estimado
           FROM vw_dispensas_federal
           ${dispWhereSql}
           GROUP BY 1`,
          dispParams
        ),
      ]);

      const totalFornecedores = num(supTotalsRows[0]?.total_fornecedores);
      const totalHom = num(supTotalsRows[0]?.total_homologado);

      const top10Suppliers = top10Rows.map((r) => {
        const val = num(r.valor_homologado);
        const name = String(r.nome_fornecedor);
        return {
          nomeFornecedor: name,
          itens: num(r.itens),
          valorHomologado: val,
          pctTotal: totalHom > 0 ? (val / totalHom) * 100 : 0,
          isPublicTech: isPublicTechSupplier(name),
          isClassificationAnomaly: isClassificationAnomalySupplier(name),
        };
      });

      const top10Valor = top10Suppliers.reduce((s, r) => s + r.valorHomologado, 0);
      const top3Valor = top10Suppliers.slice(0, 3).reduce((s, r) => s + r.valorHomologado, 0);
      const empPubValor = top10Suppliers
        .filter((r) => r.isPublicTech)
        .reduce((s, r) => s + r.valorHomologado, 0);

      const bucketOrder = [
        '0–20%',
        '20–40%',
        '40–60%',
        '60–80%',
        '80–90%',
        '90–100%',
        'Acima do teto',
      ];
      const byFaixa = new Map(histRows.map((r) => [String(r.faixa), r]));
      const totalDisp = histRows.reduce((s, r) => s + num(r.quantidade), 0);

      const dispensaHistogram = bucketOrder.map((faixa) => {
        const row = byFaixa.get(faixa);
        const q = num(row?.quantidade);
        return {
          faixa,
          quantidade: q,
          pct: totalDisp > 0 ? (q / totalDisp) * 100 : 0,
          valorEstimado: num(row?.valor_estimado),
          isAlertBucket: faixa === '90–100%',
        };
      });

      const qtd80 = dispensaHistogram.find((d) => d.faixa === '80–90%')?.quantidade ?? 0;
      const qtd90 = dispensaHistogram.find((d) => d.faixa === '90–100%')?.quantidade ?? 0;
      const qtdAcima = dispensaHistogram.find((d) => d.faixa === 'Acima do teto')?.quantidade ?? 0;

      return {
        supplierConcentration: {
          totalFornecedoresDistintos: totalFornecedores,
          valorHomologadoTotal: totalHom,
          top10Valor,
          top10Pct: totalHom > 0 ? (top10Valor / totalHom) * 100 : 0,
          top3Pct: totalHom > 0 ? (top3Valor / totalHom) * 100 : 0,
          empresasPublicasValor: empPubValor,
          empresasPublicasPct: totalHom > 0 ? (empPubValor / totalHom) * 100 : 0,
        },
        top10Suppliers,
        dispensaHistogram,
        dispensaSummary: {
          totalDispensasComTeto: totalDisp,
          qtdFaixa80a90: qtd80,
          qtdFaixa90a100: qtd90,
          qtdAcimaTeto: qtdAcima,
          razaoSalto90vs80: qtd80 > 0 ? qtd90 / qtd80 : 0,
        },
      };
    },
    (snap) => snap.enabler4
  );
}

export async function getEnabler5Data(): Promise<Enabler5Data> {
  return withLiveOrSnapshot(
    'enabler5',
    async () => {
      const [qualityRows, apiRows, outlierItemRows, outlierContractRows, nonTiRows] =
        await Promise.all([
          queryReadOnly(
            `SELECT
               (SELECT COUNT(*) FROM fato_itens_ti) AS total_raw_itens,
               (SELECT COUNT(*) FROM fato_itens_ti i LEFT JOIN fato_contratacoes c ON c.id_compra = i.id_compra WHERE c.id_compra IS NULL) AS orfaos_itens,
               (SELECT COUNT(*) FROM fato_itens_ti i JOIN fato_contratacoes c ON c.id_compra = i.id_compra WHERE c.orgao_esfera <> 'F') AS nao_federais_itens,
               (SELECT COUNT(*) FROM fato_itens_ti WHERE valor_total > 1e9 OR valor_total_resultado > 1e9) AS outliers_itens_total,
               (SELECT COALESCE(SUM(valor_total), 0) FROM fato_itens_ti WHERE valor_total > 1e9) AS outliers_itens_soma_total,
               (SELECT COUNT(*) FROM fato_itens_ti i JOIN fato_contratacoes c ON c.id_compra = i.id_compra WHERE c.orgao_esfera = 'F' AND (i.valor_total > 1e9 OR i.valor_total_resultado > 1e9)) AS outliers_itens_federal,
               (SELECT COALESCE(SUM(i.valor_total), 0) FROM fato_itens_ti i JOIN fato_contratacoes c ON c.id_compra = i.id_compra WHERE c.orgao_esfera = 'F' AND i.valor_total > 1e9) AS outliers_itens_soma_federal,
               (SELECT COUNT(*) FROM fato_contratacoes WHERE orgao_esfera = 'F' AND (valor_total_estimado > 1e10 OR valor_total_homologado > 1e10)) AS outliers_cont_federal,
               (SELECT COUNT(*) FROM vw_contratacoes_federal WHERE ano_compra = 2025) AS total_vw_cont,
               (SELECT COUNT(*) FROM vw_contratacoes_federal WHERE ano_compra = 2025 AND flag_valor_nulo_ou_zerado = 1) AS sem_valor_est,
               (SELECT COUNT(*) FROM vw_contratacoes_federal WHERE ano_compra = 2025 AND flag_alterado_apos_publicacao = 1) AS alteradas_pos_pub,
               (SELECT COUNT(*) FROM vw_itens_ti_federal WHERE ano_inclusao = 2025) AS total_vw_itens,
               (SELECT COUNT(*) FROM vw_itens_ti_federal WHERE ano_inclusao = 2025 AND flag_item_alterado = 1) AS itens_alterados,
               (SELECT COUNT(*) FROM vw_itens_ti_federal WHERE ano_inclusao = 2025 AND validado_palavra_chave_ti = 0) AS nao_validados_ti`
          ),
          queryReadOnly(
            `SELECT
               AVG(percentual_sucesso) AS media_sucesso,
               MIN(percentual_sucesso) AS min_sucesso,
               COUNT(*) AS meses,
               COALESCE(SUM(total_requisicoes), 0) AS total_reqs
             FROM fato_indicadores_api`
          ),
          queryReadOnly(
            `SELECT
               i.id_compra_item,
               COALESCE(c.orgao_razao_social, 'Órgão não localizado') AS orgao,
               COALESCE(c.orgao_esfera, '?') AS esfera,
               COALESCE(c.uf, '—') AS uf,
               COALESCE(c.modalidade_nome, '—') AS modalidade,
               COALESCE(i.mes_inclusao, '—') AS mes,
               COALESCE(i.descricao_resumida, 'Sem descrição') AS descricao,
               i.valor_total,
               i.valor_total_resultado
             FROM fato_itens_ti i
             LEFT JOIN fato_contratacoes c ON c.id_compra = i.id_compra
             WHERE i.valor_total > 1e9 OR i.valor_total_resultado > 1e9
             ORDER BY COALESCE(i.valor_total, i.valor_total_resultado) DESC
             LIMIT 25`
          ),
          queryReadOnly(
            `SELECT
               id_compra,
               COALESCE(orgao_razao_social, 'Órgão não localizado') AS orgao,
               COALESCE(orgao_esfera, '?') AS esfera,
               COALESCE(uf, '—') AS uf,
               COALESCE(modalidade_nome, '—') AS modalidade,
               COALESCE(mes_publicacao, '—') AS mes,
               COALESCE(objeto_compra, 'Sem objeto') AS descricao,
               valor_total_estimado,
               valor_total_homologado
             FROM fato_contratacoes
             WHERE valor_total_estimado > 1e10 OR valor_total_homologado > 1e10
             ORDER BY COALESCE(valor_total_estimado, valor_total_homologado) DESC
             LIMIT 10`
          ),
          queryReadOnly(
            `SELECT
               id_compra_item,
               orgao_razao_social,
               codigo_grupo,
               codigo_classe,
               descricao_resumida,
               valor_total
             FROM vw_itens_ti_federal
             WHERE ano_inclusao = 2025
               AND validado_palavra_chave_ti = 0
               AND (
                 LOWER(descricao_resumida) LIKE '%darunavir%'
                 OR LOWER(descricao_resumida) LIKE '%comprimido%'
                 OR LOWER(descricao_resumida) LIKE '%medicament%'
                 OR LOWER(descricao_resumida) LIKE '%transferência de tecnologia%'
                 OR LOWER(descricao_resumida) LIKE '%alimento%'
                 OR LOWER(descricao_resumida) LIKE '%veículo%'
               )
             ORDER BY valor_total DESC NULLS LAST
             LIMIT 6`
          ),
        ]);

      const q = qualityRows[0] ?? {};
      const a = apiRows[0] ?? {};

      const totalRaw = num(q.total_raw_itens);
      const totalCont = num(q.total_vw_cont);
      const totalVwItens = num(q.total_vw_itens);
      const semValor = num(q.sem_valor_est);
      const alteradas = num(q.alteradas_pos_pub);
      const itensAlt = num(q.itens_alterados);
      const naoFed = num(q.nao_federais_itens);
      const naoValTi = num(q.nao_validados_ti);
      const orfaos = num(q.orfaos_itens);

      const esferaLabel = (code: string) => {
        if (code === 'F') return 'Federal';
        if (code === 'E') return 'Estadual';
        if (code === 'M') return 'Municipal';
        if (code === 'D') return 'Distrital';
        return 'N/I';
      };

      const outlierAuditRows = [
        ...outlierContractRows.map((r) => ({
          tipoRegistro: 'Contratação (> R$ 10 bi)' as const,
          idRegistro: String(r.id_compra),
          orgao: String(r.orgao),
          esfera: esferaLabel(String(r.esfera)),
          uf: String(r.uf),
          modalidade: String(r.modalidade),
          mes: String(r.mes),
          descricao: String(r.descricao),
          valorEstimado: num(r.valor_total_estimado),
          valorHomologado: r.valor_total_homologado != null ? num(r.valor_total_homologado) : null,
        })),
        ...outlierItemRows.map((r) => ({
          tipoRegistro: 'Item (> R$ 1 bi)' as const,
          idRegistro: String(r.id_compra_item),
          orgao: String(r.orgao),
          esfera: esferaLabel(String(r.esfera)),
          uf: String(r.uf),
          modalidade: String(r.modalidade),
          mes: String(r.mes),
          descricao: String(r.descricao),
          valorEstimado: num(r.valor_total),
          valorHomologado: r.valor_total_resultado != null ? num(r.valor_total_resultado) : null,
        })),
      ];

      return {
        qualityMatrix: {
          integridade: {
            outliersItensQtdTotal: num(q.outliers_itens_total),
            outliersItensQtdFederal: num(q.outliers_itens_federal),
            outliersItensSomaTotal: num(q.outliers_itens_soma_total),
            outliersItensSomaFederal: num(q.outliers_itens_soma_federal),
            outliersContratacoesFederalQtd: num(q.outliers_cont_federal),
            semValorEstimadoQtd: semValor,
            semValorEstimadoPct: totalCont > 0 ? (semValor / totalCont) * 100 : 0,
            totalContratacoesBase: totalCont,
          },
          confiabilidade: {
            alteradasPosPubQtd: alteradas,
            alteradasPosPubPct: totalCont > 0 ? (alteradas / totalCont) * 100 : 0,
            itensAlteradosQtd: itensAlt,
            itensAlteradosPct: totalVwItens > 0 ? (itensAlt / totalVwItens) * 100 : 0,
          },
          conformidade: {
            totalRawItens: totalRaw,
            naoFederaisQtd: naoFed,
            naoFederaisPct: totalRaw > 0 ? (naoFed / totalRaw) * 100 : 0,
            naoValidadosTiQtd: naoValTi,
            naoValidadosTiPct: totalVwItens > 0 ? (naoValTi / totalVwItens) * 100 : 0,
          },
          disponibilidade: {
            taxaMediaSucessoApi: num(a.media_sucesso),
            menorTaxaSucessoApi: num(a.min_sucesso),
            mesesMonitorados: num(a.meses),
            totalRequisicoesApi: num(a.total_reqs),
          },
          efetividadeEficiencia: {
            itensOrfaosQtd: orfaos,
            itensOrfaosPct: totalRaw > 0 ? (orfaos / totalRaw) * 100 : 0,
          },
        },
        outlierAuditRows,
        nonTiExamples: nonTiRows.map((r) => ({
          idItem: String(r.id_compra_item),
          orgao: String(r.orgao_razao_social),
          codigoGrupo: r.codigo_grupo != null ? num(r.codigo_grupo) : null,
          codigoClasse: r.codigo_classe != null ? num(r.codigo_classe) : null,
          descricao: String(r.descricao_resumida),
          valorEstimado: num(r.valor_total),
        })),
      };
    },
    (snap) => snap.enabler5
  );
}

export async function getEnabler6Data(filters: DashboardFilters): Promise<Enabler6Data> {
  return withLiveOrSnapshot(
    `enabler6:${JSON.stringify(filters)}`,
    async () => {
      const { whereSql, params } = buildItemWhereClause(filters, 'i');

      const [apiRows, mixRows, catRows] = await Promise.all([
        queryReadOnly(
          `SELECT
             ano_mes,
             total_servicos,
             total_requisicoes,
             percentual_sucesso,
             media_tempo_resposta_ms,
             total_download_gb
           FROM fato_indicadores_api
           ORDER BY ano, mes`
        ),
        queryReadOnly(
          `SELECT
             i.material_ou_servico_nome AS tipo,
             COUNT(*) AS itens,
             COALESCE(SUM(i.valor_total), 0) AS valor_estimado,
             COALESCE(SUM(i.valor_total_resultado), 0) AS valor_homologado
           FROM vw_itens_ti_federal i
           ${whereSql}
           GROUP BY i.material_ou_servico_nome
           ORDER BY valor_estimado DESC`,
          params
        ),
        queryReadOnly(
          `SELECT
             i.material_ou_servico_nome AS tipo,
             CASE
               WHEN i.material_ou_servico = 'M' THEN 'CATMAT ' || COALESCE(i.codigo_classe::text, 'N/I')
               ELSE 'CATSER ' || COALESCE(i.codigo_grupo::text, 'N/I')
             END AS codigo,
             COALESCE(
               CASE WHEN i.material_ou_servico = 'M' THEN d.nome_classe ELSE d.nome_grupo END,
               'Grupo/Classe ' || COALESCE(i.codigo_classe::text, i.codigo_grupo::text, 'N/I')
             ) AS nome,
             COUNT(*) AS itens,
             COALESCE(SUM(i.valor_total), 0) AS valor_estimado
           FROM vw_itens_ti_federal i
           LEFT JOIN dim_catalogo_ti d
             ON (i.material_ou_servico = 'M' AND d.tipo_item = 'M' AND d.codigo_classe = i.codigo_classe)
             OR (i.material_ou_servico = 'S' AND d.tipo_item = 'S' AND d.codigo_grupo = i.codigo_grupo)
           ${whereSql}
           GROUP BY 1, 2, 3
           ORDER BY valor_estimado DESC
           LIMIT 10`,
          params
        ),
      ]);

      const apiPerformance = apiRows.map((r) => ({
        anoMes: String(r.ano_mes),
        label: MONTH_SHORT[String(r.ano_mes)] ?? String(r.ano_mes),
        totalServicos: num(r.total_servicos),
        totalRequisicoes: num(r.total_requisicoes),
        percentualSucesso: num(r.percentual_sucesso),
        mediaTempoRespostaMs: num(r.media_tempo_resposta_ms),
        totalDownloadGb: num(r.total_download_gb),
      }));

      const firstApi = apiPerformance[0];
      const lastApi = apiPerformance[apiPerformance.length - 1];
      const peakReqRow = apiPerformance.reduce(
        (best, cur) => (cur.totalRequisicoes > best.totalRequisicoes ? cur : best),
        apiPerformance[0] ?? {
          anoMes: '—',
          label: '—',
          totalRequisicoes: 0,
        }
      );

      const totalMixVal = mixRows.reduce((s, r) => s + num(r.valor_estimado), 0);
      const totalMixIts = mixRows.reduce((s, r) => s + num(r.itens), 0);

      return {
        apiPerformance,
        apiSummary: {
          latenciaInicialMs: firstApi?.mediaTempoRespostaMs ?? 0,
          latenciaFinalMs: lastApi?.mediaTempoRespostaMs ?? 0,
          fatorDegradacao:
            firstApi && firstApi.mediaTempoRespostaMs > 0
              ? (lastApi?.mediaTempoRespostaMs ?? 0) / firstApi.mediaTempoRespostaMs
              : 0,
          picoRequisicoes: peakReqRow?.totalRequisicoes ?? 0,
          picoRequisicoesMes: peakReqRow?.label ?? '—',
          totalDownloadGbAno: apiPerformance.reduce((s, r) => s + r.totalDownloadGb, 0),
        },
        mixTi: mixRows.map((r) => {
          const val = num(r.valor_estimado);
          const its = num(r.itens);
          return {
            tipo: String(r.tipo || 'Outros'),
            itens: its,
            valorEstimado: val,
            valorHomologado: num(r.valor_homologado),
            pctValor: totalMixVal > 0 ? (val / totalMixVal) * 100 : 0,
            pctItens: totalMixIts > 0 ? (its / totalMixIts) * 100 : 0,
          };
        }),
        topCatalogo: catRows.map((r) => {
          const val = num(r.valor_estimado);
          return {
            tipo: String(r.tipo),
            codigo: String(r.codigo),
            nome: normalizeCatalogTitle(String(r.nome)),
            itens: num(r.itens),
            valorEstimado: val,
            pctValor: totalMixVal > 0 ? (val / totalMixVal) * 100 : 0,
          };
        }),
      };
    },
    (snap) => snap.enabler6
  );
}

export async function getEnabler7Data(filters: DashboardFilters): Promise<Enabler7Data> {
  return withLiveOrSnapshot(
    `enabler7:${JSON.stringify(filters)}`,
    async () => {
      const { whereSql, params } = buildItemWhereClause(filters);

      const [typeRows, orgRows] = await Promise.all([
        queryReadOnly(
          `SELECT
             material_ou_servico_nome AS tipo,
             COUNT(*) AS total_itens,
             COALESCE(SUM(flag_fracasso_deserto_cancelado), 0) AS falhas_qtd,
             COALESCE(SUM(flag_erro_cadastro), 0) AS erros_qtd
           FROM vw_itens_ti_federal
           ${whereSql}
           GROUP BY material_ou_servico_nome
           ORDER BY total_itens DESC`,
          params
        ),
        queryReadOnly(
          `SELECT
             orgao_razao_social AS orgao,
             COUNT(*) AS total_itens,
             COALESCE(SUM(flag_fracasso_deserto_cancelado), 0) AS falhas_qtd,
             COALESCE(SUM(flag_erro_cadastro), 0) AS erros_qtd,
             COALESCE(SUM(valor_total), 0) AS valor_estimado
           FROM vw_itens_ti_federal
           ${whereSql}
           GROUP BY orgao_razao_social
           HAVING COUNT(*) >= ${filters.orgao || filters.mes ? 1 : 100}
           ORDER BY (COALESCE(SUM(flag_fracasso_deserto_cancelado), 0)::double precision / NULLIF(COUNT(*), 0)) DESC
           LIMIT 12`,
          params
        ),
      ]);

      const totalItens = typeRows.reduce((s, r) => s + num(r.total_itens), 0);
      const totalFalhas = typeRows.reduce((s, r) => s + num(r.falhas_qtd), 0);
      const totalErros = typeRows.reduce((s, r) => s + num(r.erros_qtd), 0);

      return {
        byItemType: typeRows.map((r) => {
          const tot = num(r.total_itens);
          const fal = num(r.falhas_qtd);
          const err = num(r.erros_qtd);
          return {
            tipo: String(r.tipo),
            totalItens: tot,
            falhasQtd: fal,
            taxaFalha: tot > 0 ? (fal / tot) * 100 : 0,
            errosCadastroQtd: err,
            taxaErroCadastro: tot > 0 ? (err / tot) * 100 : 0,
          };
        }),
        byOrgan: orgRows.map((r) => {
          const tot = num(r.total_itens);
          const fal = num(r.falhas_qtd);
          const err = num(r.erros_qtd);
          return {
            orgao: String(r.orgao),
            totalItens: tot,
            falhasQtd: fal,
            taxaFalha: tot > 0 ? (fal / tot) * 100 : 0,
            errosCadastroQtd: err,
            taxaErroCadastro: tot > 0 ? (err / tot) * 100 : 0,
            valorEstimado: num(r.valor_estimado),
          };
        }),
        summary: {
          taxaFalhaGlobal: totalItens > 0 ? (totalFalhas / totalItens) * 100 : 0,
          taxaErroCadastroGlobal: totalItens > 0 ? (totalErros / totalItens) * 100 : 0,
          totalFalhas,
          totalErrosCadastro: totalErros,
          totalItensAvaliados: totalItens,
        },
      };
    },
    (snap) => snap.enabler7
  );
}

export async function getOkrsData(): Promise<OkrsData> {
  return withLiveOrSnapshot(
    'okrs',
    async () => {
      const empty: DashboardFilters = { mes: '', modalidade: '', orgao: '', tipoItem: '' };
      const [e1, e2, e3, e4, e5, e6, e7] = await Promise.all([
        getEnabler1Data(empty),
        getEnabler2Data(empty),
        getEnabler3Data(empty),
        getEnabler4Data(empty),
        getEnabler5Data(),
        getEnabler6Data(empty),
        getEnabler7Data(empty),
      ]);

      const pctDiretasFederal = e1.summary.pctDiretaContratacoes;
      const pctDiretasTO = e3.kpis.pctDiretasTO;
      const economiaPregao = e2.summary.economiaPregao;
      const economiaDispensa = e2.summary.economiaDispensa;
      const outliersFederalQtd = e5.qualityMatrix.integridade.outliersItensQtdFederal;
      const naoFederaisPct = e5.qualityMatrix.conformidade.naoFederaisPct;
      const orfaosPct = e5.qualityMatrix.efetividadeEficiencia.itensOrfaosPct;
      const latenciaFinalMs = e6.apiSummary.latenciaFinalMs;
      const taxaFalhaItens = e7.summary.taxaFalhaGlobal;

      const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

      return {
        baselines: {
          pctDiretasFederal,
          pctDiretasTO,
          economiaPregao,
          economiaDispensa,
          outliersFederalQtd,
          naoFederaisPct,
          orfaosPct,
          latenciaFinalMs,
          taxaFalhaItens,
        },
        okrs: [
          {
            codigo: 'OKR 1',
            titulo: 'Competição, Escala e Eficiência Econômica nas Aquisições de TI',
            objetivo:
              'Reduzir a dependência estrutural de contratações diretas e ampliar compras competitivas compartilhadas (SRP/centrais de compra), convertendo a diretriz da Lei nº 14.133/2021 em economia efetiva.',
            habilitadores: [
              'H1 · Princípios e Políticas',
              'H2 · Processos',
              'H3 · Estruturas Organizacionais',
              'H4 · Cultura e Ética',
            ],
            dominiosCobit: ['APO10', 'BAI03', 'MEA01'],
            prazoGeral: '12 meses (Ciclo PCA 2026–2027)',
            justificativa: `Em 2025, ${fmtPct(pctDiretasFederal)} das contratações federais de TI ocorreram via contratação direta (${fmtPct(pctDiretasTO)} no Tocantins), mesmo com o Pregão Eletrônico gerando economia média de ${fmtPct(economiaPregao)} contra ${fmtPct(economiaDispensa)} na Dispensa. Além disso, ${e4.dispensaSummary.qtdFaixa90a100} dispensas acumularam-se na faixa de 90–100% do teto legal.`,
            keyResults: [
              {
                id: 'KR 1.1',
                titulo: 'Reduzir a proporção de contratações diretas na esfera federal',
                baselineLabel: `${fmtPct(pctDiretasFederal)} (2025)`,
                metaLabel: '≤ 45,0%',
                baselineNum: pctDiretasFederal,
                metaNum: 45,
                progressoAtualPct: Math.min(100, Math.max(8, Math.round((45 / Math.max(pctDiretasFederal, 1)) * 100))),
                unidade: '% de contratações diretas',
                prazo: 'Q4/2026',
                evidencia: `Base atual: ${fmtPct(pctDiretasFederal)} em quantidade e ${fmtPct(e1.summary.pctDiretaValor)} em valor estimado.`,
              },
              {
                id: 'KR 1.2',
                titulo: 'Reduzir contratações diretas nas unidades federais do Tocantins via compras compartilhadas',
                baselineLabel: `${fmtPct(pctDiretasTO)} (TO 2025)`,
                metaLabel: '≤ 50,0%',
                baselineNum: pctDiretasTO,
                metaNum: 50,
                progressoAtualPct: Math.min(100, Math.max(8, Math.round((50 / Math.max(pctDiretasTO, 1)) * 100))),
                unidade: '% diretas no recorte TO',
                prazo: 'Q4/2026',
                evidencia: `Atualmente ${e3.kpis.qtdDiretasTO} de ${e3.kpis.totalContratacoesTO} compras de TI no TO são diretas, com baixa escala individual.`,
              },
              {
                id: 'KR 1.3',
                titulo: 'Mitigar o acúmulo de dispensas na faixa crítica de 90–100% do limite do art. 75, II',
                baselineLabel: `${e4.dispensaSummary.qtdFaixa90a100} dispensas (${e4.dispensaSummary.razaoSalto90vs80.toFixed(2).replace('.', ',')}× faixa 80–90%)`,
                metaLabel: 'Razão ≤ 1,10× com revisão prévia',
                baselineNum: e4.dispensaSummary.razaoSalto90vs80,
                metaNum: 1.1,
                progressoAtualPct: Math.min(100, Math.max(10, Math.round((1.1 / Math.max(e4.dispensaSummary.razaoSalto90vs80, 1)) * 100))),
                unidade: 'razão de concentração',
                prazo: 'Q3/2026',
                evidencia: `Salto estatístico de ${e4.dispensaSummary.qtdFaixa80a90} (80–90%) para ${e4.dispensaSummary.qtdFaixa90a100} (90–100%) sinaliza risco de fracionamento.`,
              },
              {
                id: 'KR 1.4',
                titulo: 'Reduzir a taxa global de itens desertos, fracassados ou cancelados',
                baselineLabel: `${fmtPct(taxaFalhaItens)} (2025)`,
                metaLabel: '≤ 6,5%',
                baselineNum: taxaFalhaItens,
                metaNum: 6.5,
                progressoAtualPct: Math.min(100, Math.max(10, Math.round((6.5 / Math.max(taxaFalhaItens, 1)) * 100))),
                unidade: '% de retrabalho licitatório',
                prazo: 'Q4/2026',
                evidencia: `${e2.summary.totalRetrabalho.toLocaleString('pt-BR')} itens não concluídos exigiram retrabalho técnico e administrativo.`,
              },
            ],
          },
          {
            codigo: 'OKR 2',
            titulo: 'Integridade, Conformidade e Desempenho dos Dados Abertos de TI',
            objetivo:
              'Eliminar distorções cadastrais críticas no PNCP/Compras.gov.br, garantir separação federativa e catalográfica confiável e estabilizar a infraestrutura da API aberta.',
            habilitadores: [
              'H5 · Informação',
              'H6 · Serviços, Infraestrutura e Aplicativos',
              'H7 · Pessoas, Habilidades e Competências',
            ],
            dominiosCobit: ['APO11', 'BAI08', 'DSS01', 'MEA01'],
            prazoGeral: '12 meses (Saneamento Contínuo 2026)',
            justificativa: `Foram detectados ${outliersFederalQtd} itens federais acima de R$ 1 bilhão (e ${e5.qualityMatrix.integridade.outliersItensQtdTotal} na base total somando trilhões), ${fmtPct(naoFederaisPct)} de registros subnacionais misturados na extração federal, ${fmtPct(orfaosPct)} de itens órfãos e degradação de ${e6.apiSummary.fatorDegradacao.toFixed(1).replace('.', ',')}× na latência da API até dezembro.`,
            keyResults: [
              {
                id: 'KR 2.1',
                titulo: 'Zerar registros federais implausíveis (> R$ 1 bi/item) via crítica automática no cadastro',
                baselineLabel: `${outliersFederalQtd} itens federais (2025)`,
                metaLabel: '0 ocorrências sem dupla alçada',
                baselineNum: outliersFederalQtd,
                metaNum: 0,
                progressoAtualPct: 12,
                unidade: 'outliers críticos federais',
                prazo: 'Q2/2026',
                evidencia: `Somente 4 contratações federais distorcidas somavam trilhões no campo estimado antes do saneamento.`,
              },
              {
                id: 'KR 2.2',
                titulo: 'Reduzir a taxa de itens órfãos (sem contratação vinculada) na API de dados abertos',
                baselineLabel: `${fmtPct(orfaosPct)} (${e5.qualityMatrix.efetividadeEficiencia.itensOrfaosQtd.toLocaleString('pt-BR')} itens)`,
                metaLabel: '≤ 1,0%',
                baselineNum: orfaosPct,
                metaNum: 1.0,
                progressoAtualPct: Math.min(100, Math.max(8, Math.round((1.0 / Math.max(orfaosPct, 1)) * 100))),
                unidade: '% de quebra referencial',
                prazo: 'Q3/2026',
                evidencia: `Integridade referencial entre endpoints de itens e contratações é pré-requisito para controle social.`,
              },
              {
                id: 'KR 2.3',
                titulo: 'Restaurar a latência média da API Compras.gov.br e sustentar disponibilidade ≥ 99,8%',
                baselineLabel: `${Math.round(latenciaFinalMs).toLocaleString('pt-BR')} ms (Dez/2025)`,
                metaLabel: '≤ 300 ms em pico mensal',
                baselineNum: latenciaFinalMs,
                metaNum: 300,
                progressoAtualPct: Math.min(100, Math.max(10, Math.round((300 / Math.max(latenciaFinalMs, 1)) * 100))),
                unidade: 'tempo médio de resposta (ms)',
                prazo: 'Q3/2026',
                evidencia: `Latência saltou de ${Math.round(e6.apiSummary.latenciaInicialMs)} ms (Abr/25) para ${Math.round(latenciaFinalMs).toLocaleString('pt-BR')} ms (Dez/25).`,
              },
              {
                id: 'KR 2.4',
                titulo: 'Capacitar agentes de contratação em catalogação CATMAT/CATSER e publicar 100% do PCA no TO',
                baselineLabel: `0 registros PCA-TO · ${fmtPct(e7.summary.taxaErroCadastroGlobal)} erro cadastro`,
                metaLabel: '100% UASGs TO no PCA · ≤ 0,3% erro',
                baselineNum: e7.summary.taxaErroCadastroGlobal,
                metaNum: 0.3,
                progressoAtualPct: Math.min(100, Math.max(12, Math.round((0.3 / Math.max(e7.summary.taxaErroCadastroGlobal, 0.3)) * 100))),
                unidade: 'maturidade cadastral e PCA',
                prazo: 'Q4/2026',
                evidencia: `Tabela fato_pca_to sem registros publicados e classificação incorreta de insumos não-TI (ex.: fármacos em CATSER 182).`,
              },
            ],
          },
        ],
      };
    },
    (snap) => snap.okrs
  );
}
