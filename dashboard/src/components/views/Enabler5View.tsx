import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import type { Enabler5Data } from '../../types/dashboard';
import {
  formatCurrencyCompact,
  formatCurrencyFull,
  formatEntityName,
  formatMonthShort,
  formatNumber,
  formatPercent,
} from '../../utils/formatters';
import {
  CobitConceptBanner,
  ErrorBanner,
  Panel,
  SectionSkeleton,
} from '../LayoutPrimitives';

export function Enabler5View() {
  const { data, loading, error, refetch } = useDashboardApi<Enabler5Data>('/api/enabler/5');
  const [auditFilter, setAuditFilter] = useState<'all' | 'Federal' | 'subnacional'>('all');
  const [auditSearch, setAuditSearch] = useState('');

  const filteredOutliers = useMemo(() => {
    if (!data) return [];
    const term = auditSearch.trim().toLowerCase();
    return data.outlierAuditRows.filter((row) => {
      if (auditFilter === 'Federal' && row.esfera !== 'Federal') return false;
      if (auditFilter === 'subnacional' && row.esfera === 'Federal') return false;
      if (!term) return true;
      return (
        row.orgao.toLowerCase().includes(term) ||
        row.descricao.toLowerCase().includes(term) ||
        row.idRegistro.toLowerCase().includes(term) ||
        row.uf.toLowerCase().includes(term)
      );
    });
  }, [data, auditFilter, auditSearch]);

  if (loading && !data) return <SectionSkeleton />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!data) return null;

  const { qualityMatrix: q, nonTiExamples } = data;

  const criteriaCards = [
    {
      num: '01',
      title: 'Integridade',
      status: 'Crítico',
      tone: 'alert' as const,
      metric: `${formatNumber(q.integridade.outliersItensQtdTotal)} itens > R$ 1 bi`,
      submetric: `Soma bruta: ${formatCurrencyCompact(q.integridade.outliersItensSomaTotal)} (${formatNumber(
        q.integridade.outliersItensQtdFederal
      )} federais = ${formatCurrencyCompact(q.integridade.outliersItensSomaFederal)})`,
      detail: `${formatPercent(q.integridade.semValorEstimadoPct)} das contratações (${formatNumber(
        q.integridade.semValorEstimadoQtd
      )}) estão sem valor estimado ou zeradas.`,
    },
    {
      num: '02',
      title: 'Confiabilidade',
      status: 'Atenção',
      tone: 'alert' as const,
      metric: formatPercent(q.confiabilidade.alteradasPosPubPct),
      submetric: `${formatNumber(q.confiabilidade.alteradasPosPubQtd)} contratações alteradas pós-publicação`,
      detail: `${formatPercent(q.confiabilidade.itensAlteradosPct)} dos itens (${formatNumber(
        q.confiabilidade.itensAlteradosQtd
      )}) sofreram retificação posterior no PNCP.`,
    },
    {
      num: '03',
      title: 'Conformidade',
      status: 'Crítico',
      tone: 'alert' as const,
      metric: formatPercent(q.conformidade.naoFederaisPct),
      submetric: `${formatNumber(q.conformidade.naoFederaisQtd)} itens estaduais/municipais na base federal`,
      detail: `Entre itens federais, ${formatPercent(q.conformidade.naoValidadosTiPct)} não possuem palavra-chave de TI na descrição (ex.: fármacos em CATSER 182).`,
    },
    {
      num: '04',
      title: 'Disponibilidade',
      status: 'Nominal',
      tone: 'teal' as const,
      metric: formatPercent(q.disponibilidade.taxaMediaSucessoApi, 2),
      submetric: `Taxa média de sucesso da API (${q.disponibilidade.mesesMonitorados} meses)`,
      detail: `Menor taxa mensal: ${formatPercent(q.disponibilidade.menorTaxaSucessoApi, 2)} em ${formatNumber(
        q.disponibilidade.totalRequisicoesApi
      )} requisições monitoradas.`,
    },
    {
      num: '05',
      title: 'Efetividade e Eficiência',
      status: 'Atenção',
      tone: 'alert' as const,
      metric: formatPercent(q.efetividadeEficiencia.itensOrfaosPct),
      submetric: `${formatNumber(q.efetividadeEficiencia.itensOrfaosQtd)} itens órfãos sem contratação pai`,
      detail: `Quebra de integridade referencial sobre ${formatNumber(
        q.conformidade.totalRawItens
      )} itens brutos exige saneamento prévio para qualquer análise gerencial.`,
    },
  ];

  return (
    <div className="space-y-5">
      <CobitConceptBanner
        kicker="COBIT 5 · Habilitador 5 · Informação · Critérios de Qualidade da Informação"
        title="Auditoria da Qualidade dos Dados Abertos do Compras.gov.br"
        concept="No COBIT 5, a Informação só gera valor de governança quando atende simultaneamente a critérios intrínsecos, contextuais e de acessibilidade: Integridade, Confiabilidade, Conformidade, Disponibilidade e Efetividade/Eficiência."
        diagnosis={`Embora a disponibilidade da API permaneça alta (${formatPercent(
          q.disponibilidade.taxaMediaSucessoApi,
          2
        )}), falhas severas de integridade e conformidade comprometem o uso direto dos dados abertos: ${formatNumber(
          q.integridade.outliersItensQtdTotal
        )} itens ultrapassam R$ 1 bilhão (somando ${formatCurrencyCompact(
          q.integridade.outliersItensSomaTotal
        )}), ${formatPercent(
          q.conformidade.naoFederaisPct
        )} dos registros brutos não são federais e ${formatPercent(
          q.efetividadeEficiencia.itensOrfaosPct
        )} são itens órfãos.`}
        emphasisTone="alert"
      />

      {/* Matriz de 5 Critérios de Qualidade do COBIT 5 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {criteriaCards.map((c) => (
          <div
            key={c.title}
            className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[#64748B]">{c.num}</span>
                <span
                  className={`font-semibold ${
                    c.tone === 'alert' ? 'text-[#C85A17]' : 'text-[#0F6B72]'
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-semibold text-[#0F172A]">{c.title}</h3>
              <div
                className={`mt-2 text-xl font-semibold font-mono tabular-nums ${
                  c.tone === 'alert' ? 'text-[#C85A17]' : 'text-[#0F6B72]'
                }`}
              >
                {c.metric}
              </div>
              <div className="mt-1 text-[11.5px] font-medium text-[#334155] leading-snug">
                {c.submetric}
              </div>
            </div>
            <p className="mt-3 pt-2.5 border-t border-[#F1F5F9] text-[11.5px] text-[#64748B] leading-relaxed">
              {c.detail}
            </p>
          </div>
        ))}
      </div>

      {/* Tabela Interativa de Auditoria de Outliers */}
      <Panel
        title="Tabela de Auditoria ao Vivo · Registros Outliers / Implausíveis (> R$ 1 bi e > R$ 10 bi)"
        subtitle="Registros excluídos dos KPIs financeiros principais pelo saneamento e preservados aqui como prova de falha de integridade"
        headerRight={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filtrar órgão, objeto ou ID..."
                className="h-8 pl-8 pr-3 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F6B72] w-52"
              />
            </div>
            <div className="inline-flex items-center p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'Federal', label: 'Federais' },
                  { id: 'subnacional', label: 'Estados/Munic.' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAuditFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    auditFilter === tab.id
                      ? 'bg-white text-[#0F6B72] shadow-xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#F8FAFC] z-10">
              <tr className="text-left text-[#64748B] border-b border-[#E2E8F0]">
                <th className="py-2.5 px-2 font-medium whitespace-nowrap">Tipo / ID</th>
                <th className="py-2.5 px-2 font-medium">Órgão · Esfera/UF</th>
                <th className="py-2.5 px-2 font-medium">Objeto / Descrição</th>
                <th className="py-2.5 px-2 font-medium whitespace-nowrap">Mês</th>
                <th className="py-2.5 px-2 font-medium text-right whitespace-nowrap">
                  Valor Estimado (Erro)
                </th>
                <th className="py-2.5 px-2 font-medium text-right whitespace-nowrap">
                  Valor Homologado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filteredOutliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#64748B]">
                    Nenhum registro outlier corresponde ao filtro informado.
                  </td>
                </tr>
              ) : (
                filteredOutliers.map((row) => (
                  <tr key={`${row.tipoRegistro}-${row.idRegistro}`} className="hover:bg-[#FDF8F5]">
                    <td className="py-2.5 px-2 align-top whitespace-nowrap">
                      <div className="font-semibold text-[#C85A17]">{row.tipoRegistro}</div>
                      <div className="font-mono text-[11px] text-[#64748B]">{row.idRegistro}</div>
                    </td>
                    <td className="py-2.5 px-2 align-top max-w-[240px]">
                      <div className="font-medium text-[#0F172A] leading-snug" title={row.orgao}>
                        {formatEntityName(row.orgao)}
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        {row.esfera} · {row.uf} · {row.modalidade}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 align-top max-w-[300px] text-[#334155] leading-snug">
                      <div className="line-clamp-2" title={row.descricao}>
                        {row.descricao}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 align-top font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                      {formatMonthShort(row.mes)}
                    </td>
                    <td className="py-2.5 px-2 align-top text-right font-mono tabular-nums font-semibold text-[#C85A17] whitespace-nowrap">
                      <div>{formatCurrencyCompact(row.valorEstimado)}</div>
                      <div className="text-[10.5px] font-normal text-[#64748B]">
                        {formatCurrencyFull(row.valorEstimado)}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 align-top text-right font-mono tabular-nums text-[#0F172A] whitespace-nowrap">
                      {row.valorHomologado != null && row.valorHomologado > 0
                        ? formatCurrencyFull(row.valorHomologado)
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Exemplos de Erro de Classificação (Não-TI em catálogo de TI) */}
      {nonTiExamples.length > 0 ? (
        <Panel
          title="Evidências de Erro de Classificação Catalográfica (Itens Não-TI em Grupos de TIC)"
          subtitle="Itens de alta materialidade enquadrados em grupos de TI (ex.: CATSER 182) cuja descrição refere-se a insumos externos à área de tecnologia"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#64748B] border-b border-[#E2E8F0]">
                  <th className="py-2 px-2 font-medium">Órgão</th>
                  <th className="py-2 px-2 font-medium">Código Catálogo</th>
                  <th className="py-2 px-2 font-medium">Descrição Registrada no Compras.gov.br</th>
                  <th className="py-2 px-2 font-medium text-right">Valor Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {nonTiExamples.map((ex) => (
                  <tr key={ex.idItem} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-2 font-medium text-[#0F172A] whitespace-nowrap" title={ex.orgao}>
                      {formatEntityName(ex.orgao)}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[#0F6B72] whitespace-nowrap">
                      {ex.codigoGrupo != null
                        ? `CATSER ${ex.codigoGrupo}`
                        : `CATMAT ${ex.codigoClasse ?? '—'}`}
                    </td>
                    <td className="py-2.5 px-2 text-[#334155] leading-snug max-w-xl">
                      {ex.descricao}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-[#C85A17] whitespace-nowrap">
                      {formatCurrencyCompact(ex.valorEstimado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
