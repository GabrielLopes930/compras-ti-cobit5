import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import type { DashboardFilters, Enabler2Data } from '../../types/dashboard';
import {
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from '../../utils/formatters';
import {
  CobitConceptBanner,
  EmptyNotice,
  ErrorBanner,
  KpiCard,
  Panel,
  SectionSkeleton,
} from '../LayoutPrimitives';

interface Enabler2ViewProps {
  filters: DashboardFilters;
  onClearFilters: () => void;
}

export function Enabler2View({ filters, onClearFilters }: Enabler2ViewProps) {
  const { data, loading, error, refetch } = useDashboardApi<Enabler2Data>('/api/enabler/2', filters);

  if (loading && !data) return <SectionSkeleton />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!data) return null;

  const isEmpty = data.summary.totalItens === 0;

  return (
    <div className="space-y-5">
      <CobitConceptBanner
        kicker="COBIT 5 · Habilitador 2 · Processos · Domínios APO10, BAI03 e MEA01"
        title="Indicador de Resultado (Economia) vs. Indicador de Execução (Desfecho dos Itens)"
        concept="Os processos de gestão de fornecedores (APO10), entrega de soluções (BAI03) e monitoramento de desempenho (MEA01) exigem separar indicadores de resultado (desconto econômico efetivo) de indicadores de execução (capacidade de homologar sem retrabalho de itens desertos, fracassados ou cancelados)."
        diagnosis={
          isEmpty
            ? 'Sem itens para os filtros selecionados.'
            : `O Pregão Eletrônico alcançou economia média de ${formatPercent(
                data.summary.economiaPregao
              )}, frente a ${formatPercent(
                data.summary.economiaDispensa
              )} na Dispensa e apenas ${formatPercent(
                data.summary.economiaInexigibilidade
              )} na Inexigibilidade. Na execução, ${formatPercent(
                data.summary.taxaRetrabalho
              )} dos itens (${formatNumber(
                data.summary.totalRetrabalho
              )} registros) terminaram desertos, fracassados ou cancelados.`
        }
      />

      {isEmpty ? (
        <EmptyNotice
          title="Nenhum item encontrado para os filtros aplicados"
          description="Altere os filtros no topo para inspecionar a eficiência dos processos licitatórios."
          actionLabel="Limpar filtros"
          onAction={onClearFilters}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Economia Média · Pregão Eletrônico"
              value={formatPercent(data.summary.economiaPregao)}
              sublabel="Indicador de Resultado (com competição)"
              tone="teal"
            />
            <KpiCard
              label="Economia Média · Dispensa"
              value={formatPercent(data.summary.economiaDispensa)}
              sublabel="Contratação direta por limite/emergência"
            />
            <KpiCard
              label="Economia Média · Inexigibilidade"
              value={formatPercent(data.summary.economiaInexigibilidade)}
              sublabel="Ausência de competição / exclusividade"
              tone="alert"
            />
            <KpiCard
              label="Taxa de Retrabalho (Deserto/Frac./Canc.)"
              value={formatPercent(data.summary.taxaRetrabalho)}
              sublabel={`${formatNumber(data.summary.totalRetrabalho)} de ${formatNumber(
                data.summary.totalItens
              )} itens`}
              tone="alert"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Economia Percentual por Modalidade */}
            <Panel
              className="lg:col-span-7"
              title="Economia Percentual por Modalidade (Indicador de Resultado)"
              subtitle="Pares válidos com valor homologado entre 1% e 200% do estimado — média simples vs. ponderada pelo valor"
            >
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.savingsByModality}
                    margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="modalidade"
                      tick={{ fill: '#334155', fontSize: 12 }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      cursor={{ fill: '#F8FAFC' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as Enabler2Data['savingsByModality'][number];
                        return (
                          <div className="bg-white border border-[#CBD5E1] rounded-lg p-3 shadow-md text-xs space-y-1">
                            <div className="font-semibold text-[#0F172A]">{row.modalidade}</div>
                            <div className="font-mono tabular-nums text-[#0F6B72] font-semibold">
                              Economia Média Simples: {formatPercent(row.economiaMedia)}
                            </div>
                            <div className="font-mono tabular-nums text-[#C85A17] font-semibold">
                              Economia Ponderada (R$): {formatPercent(row.economiaPonderada)}
                            </div>
                            <div className="font-mono tabular-nums text-[#64748B] pt-1 border-t border-[#F1F5F9]">
                              Base: {formatNumber(row.paresValidos)} pares válidos · Est.{' '}
                              {formatCurrencyCompact(row.valorEstimadoPares)}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      formatter={(val) =>
                        val === 'economiaMedia' ? 'Economia Média Simples (%)' : 'Economia Ponderada em R$ (%)'
                      }
                    />
                    <Bar
                      dataKey="economiaMedia"
                      fill="#0F6B72"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={42}
                    />
                    <Bar
                      dataKey="economiaPonderada"
                      fill="#C85A17"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={42}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 pt-3 border-t border-[#F1F5F9] text-xs text-[#64748B] leading-relaxed">
                Destaque metodológico: na Dispensa, a economia ponderada cai drasticamente frente à
                média simples porque dispensas de alto valor (como empresas públicas e emergenciais)
                concentram descontos residuais.
              </p>
            </Panel>

            {/* Desfecho dos Itens */}
            <Panel
              className="lg:col-span-5"
              title="Desfecho dos Itens de TI (Indicador de Execução)"
              subtitle="Homologados com sucesso vs. itens com retrabalho (Cancelados, Fracassados e Desertos)"
            >
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.itemOutcomes}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatNumber(Number(v))}
                      tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="situacao"
                      width={150}
                      tick={{ fill: '#0F172A', fontSize: 11.5 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#F8FAFC' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as Enabler2Data['itemOutcomes'][number];
                        return (
                          <div className="bg-white border border-[#CBD5E1] rounded-lg p-3 shadow-md text-xs space-y-1">
                            <div className="font-semibold text-[#0F172A]">{row.situacao}</div>
                            <div className="font-mono tabular-nums">
                              {formatNumber(row.quantidade)} itens ({formatPercent(row.percentual)})
                            </div>
                            <div className={row.isRetrabalho ? 'text-[#C85A17] font-medium' : 'text-[#0F6B72]'}>
                              {row.isRetrabalho
                                ? 'Classificado como retrabalho / perda processual'
                                : 'Fluxo regular / concluído'}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="quantidade" radius={[0, 5, 5, 0]} barSize={22}>
                      {data.itemOutcomes.map((item) => (
                        <Cell
                          key={item.situacao}
                          fill={
                            item.isRetrabalho
                              ? '#C85A17'
                              : item.situacao.toLowerCase().includes('homolog')
                                ? '#0F6B72'
                                : '#64748B'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E8F0] space-y-2">
                {data.itemOutcomes.map((o) => (
                  <div key={o.situacao} className="flex items-center justify-between text-xs">
                    <span
                      className={
                        o.isRetrabalho
                          ? 'text-[#C85A17] font-medium'
                          : 'text-[#334155] font-medium'
                      }
                    >
                      {o.situacao}
                    </span>
                    <span className="font-mono tabular-nums text-[#0F172A]">
                      {formatNumber(o.quantidade)}{' '}
                      <span className="text-[#64748B]">({formatPercent(o.percentual)})</span>
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
