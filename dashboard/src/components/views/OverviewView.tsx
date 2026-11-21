import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import type { DashboardFilters, OverviewData } from '../../types/dashboard';
import {
  formatCurrencyCompact,
  formatCurrencyFull,
  formatMonthFull,
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

interface OverviewViewProps {
  filters: DashboardFilters;
  onClearFilters: () => void;
}

export function OverviewView({ filters, onClearFilters }: OverviewViewProps) {
  const { data, loading, error, refetch } = useDashboardApi<OverviewData>('/api/overview', filters);

  if (loading && !data) return <SectionSkeleton />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!data) return null;

  const { kpis, monthlyEvolution, mixTipoItem } = data;
  const isEmpty = kpis.totalItens === 0;
  const peakMonth = monthlyEvolution.find((m) => m.isPeak);
  const servicos = mixTipoItem.find((m) => m.tipo === 'Serviço');
  const materiais = mixTipoItem.find((m) => m.tipo === 'Material');

  return (
    <div className="space-y-5">
      <CobitConceptBanner
        kicker="Síntese Executiva · Compras.gov.br · Lei nº 14.133/2021 · Esfera Federal 2025"
        title="Panorama das Contratações Federais de TI sob a Ótica do COBIT 5"
        concept="A análise consolida os itens de Tecnologia da Informação adquiridos pela Administração Pública Federal em 2025 após saneamento de outliers cadastrais (> R$ 1 bi por item e > R$ 10 bi por contratação), estruturando evidências empíricas para os 7 habilitadores de governança do COBIT 5."
        diagnosis={
          isEmpty
            ? 'Nenhum item federal de TI corresponde à combinação atual de filtros.'
            : `Foram analisados ${formatNumber(kpis.totalItens)} itens distribuídos em ${formatNumber(
                kpis.totalContratacoes
              )} contratações federais, totalizando ${formatCurrencyCompact(
                kpis.valorEstimado
              )} estimados e ${formatCurrencyCompact(
                kpis.valorHomologado
              )} homologados, com economia média de ${formatPercent(
                kpis.economiaMediaGlobal
              )} nos ${formatNumber(kpis.paresValidosEconomia)} pares válidos${
                peakMonth
                  ? ` e pico financeiro em ${formatMonthFull(peakMonth.mes)} (${formatCurrencyCompact(
                      peakMonth.valorEstimado
                    )}).`
                  : '.'
              }`
        }
      />

      {isEmpty ? (
        <EmptyNotice
          title="Nenhum registro encontrado para os filtros aplicados"
          description="Ajuste o mês, modalidade, órgão ou tipo de item na barra superior para visualizar os indicadores."
          actionLabel="Limpar filtros"
          onAction={onClearFilters}
        />
      ) : (
        <>
          {/* 4 KPI Cards principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Total de Itens de TI (Saneados)"
              value={formatNumber(kpis.totalItens)}
              sublabel="Esfera Federal · 2025 · ≤ R$ 1 bi/item"
              tone="teal"
            />
            <KpiCard
              label="Total de Contratações Federais"
              value={formatNumber(kpis.totalContratacoes)}
              sublabel="Processos distintos com itens de TI"
            />
            <KpiCard
              label="Valor Total Estimado"
              value={formatCurrencyCompact(kpis.valorEstimado)}
              sublabel={formatCurrencyFull(kpis.valorEstimado)}
              tone="teal"
            />
            <KpiCard
              label="Valor Total Homologado"
              value={formatCurrencyCompact(kpis.valorHomologado)}
              sublabel={`Economia média: ${formatPercent(kpis.economiaMediaGlobal)} (${formatNumber(
                kpis.paresValidosEconomia
              )} pares)`}
              tone="positive"
            />
          </div>

          {/* Gráfico Mensal + Resumo Rápido */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <Panel
              className="lg:col-span-8"
              title="Evolução Mensal do Valor Estimado em 2025 (Jan–Dez)"
              subtitle="Série mensal dos itens federais de TI saneados — destaque em laranja para o pico orçamentário do exercício"
              headerRight={
                peakMonth ? (
                  <div className="text-right">
                    <div className="text-[11px] text-[#64748B]">Pico do Exercício</div>
                    <div className="text-xs font-semibold font-mono tabular-nums text-[#C85A17]">
                      {peakMonth.label}/25 · {formatCurrencyCompact(peakMonth.valorEstimado)}
                    </div>
                  </div>
                ) : null
              }
            >
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyEvolution}
                    margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                      tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                      axisLine={false}
                      tickLine={false}
                      width={82}
                    />
                    <Tooltip
                      cursor={{ fill: '#F1F5F9' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as OverviewData['monthlyEvolution'][number];
                        return (
                          <div className="bg-white border border-[#CBD5E1] rounded-lg p-3 shadow-md text-xs space-y-1">
                            <div className="font-semibold text-[#0F172A]">
                              {formatMonthFull(row.mes)}
                              {row.isPeak ? ' — Pico Anual' : ''}
                            </div>
                            <div className="flex justify-between gap-5">
                              <span className="text-[#64748B]">Estimado:</span>
                              <span className="font-mono tabular-nums font-semibold text-[#0F6B72]">
                                {formatCurrencyFull(row.valorEstimado)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-5">
                              <span className="text-[#64748B]">Homologado:</span>
                              <span className="font-mono tabular-nums font-medium text-[#334155]">
                                {formatCurrencyFull(row.valorHomologado)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-5 pt-1 border-t border-[#F1F5F9]">
                              <span className="text-[#64748B]">Volume:</span>
                              <span className="font-mono tabular-nums text-[#334155]">
                                {formatNumber(row.totalItens)} itens · {formatNumber(row.totalContratacoes)} compras
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="valorEstimado" radius={[5, 5, 0, 0]} maxBarSize={44}>
                      {monthlyEvolution.map((entry) => (
                        <Cell
                          key={entry.mes}
                          fill={entry.isPeak ? '#C85A17' : '#0F6B72'}
                          fillOpacity={filters.mes && filters.mes !== entry.mes ? 0.35 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#0F6B72]" />
                    Demais meses (2025)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#C85A17]" />
                    Pico anual (concentração de fim de exercício)
                  </span>
                </div>
                <span className="font-mono tabular-nums">
                  {peakMonth && kpis.valorEstimado > 0
                    ? `${peakMonth.label} concentra ${formatPercent(
                        (peakMonth.valorEstimado / kpis.valorEstimado) * 100
                      )} do valor anual`
                    : ''}
                </span>
              </div>
            </Panel>

            {/* Resumo Rápido: Serviços vs Materiais + Economia Global */}
            <Panel
              className="lg:col-span-4"
              title="Composição e Eficiência Global"
              subtitle="Distribuição Serviços vs. Materiais e taxa média de desconto obtida"
            >
              <div className="flex flex-col justify-between h-full gap-5">
                {/* Proporção por Valor */}
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-[#0F172A]">
                      Proporção por Valor Estimado
                    </span>
                    <span className="text-xs font-mono tabular-nums text-[#64748B]">
                      {formatCurrencyCompact(kpis.valorEstimado)}
                    </span>
                  </div>

                  {/* Barra empilhada limpa */}
                  <div className="h-3.5 w-full bg-[#F1F5F9] rounded-md overflow-hidden flex">
                    <div
                      className="h-full bg-[#0F6B72] transition-all"
                      style={{ width: `${servicos?.pctValor ?? 0}%` }}
                      title={`Serviços: ${formatPercent(servicos?.pctValor ?? 0)}`}
                    />
                    <div
                      className="h-full bg-[#C85A17] transition-all"
                      style={{ width: `${materiais?.pctValor ?? 0}%` }}
                      title={`Materiais: ${formatPercent(materiais?.pctValor ?? 0)}`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-0.5">
                      <div className="text-xs text-[#64748B] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-xs bg-[#0F6B72]" />
                        Serviços de TIC
                      </div>
                      <div className="text-lg font-semibold font-mono tabular-nums text-[#0F172A]">
                        {formatPercent(servicos?.pctValor ?? 0)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-[#64748B]">
                        {formatCurrencyCompact(servicos?.valorEstimado ?? 0)} · {formatNumber(servicos?.itens ?? 0)} itens
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-xs text-[#64748B] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-xs bg-[#C85A17]" />
                        Materiais de TI
                      </div>
                      <div className="text-lg font-semibold font-mono tabular-nums text-[#0F172A]">
                        {formatPercent(materiais?.pctValor ?? 0)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-[#64748B]">
                        {formatCurrencyCompact(materiais?.valorEstimado ?? 0)} · {formatNumber(materiais?.itens ?? 0)} itens
                      </div>
                    </div>
                  </div>
                </div>

                {/* Divisor */}
                <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
                  <div className="text-xs font-semibold text-[#0F172A]">
                    Economia Global (Pares Válidos 1%–200%)
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[11px] text-[#64748B]">Economia Média Simples</div>
                      <div className="mt-0.5 text-2xl font-semibold font-mono tabular-nums text-[#0F6B72]">
                        {formatPercent(kpis.economiaMediaGlobal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#64748B]">Economia Ponderada (R$)</div>
                      <div className="mt-0.5 text-2xl font-semibold font-mono tabular-nums text-[#334155]">
                        {formatPercent(kpis.economiaPonderadaGlobal)}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#64748B] leading-relaxed">
                    A diferença entre a média simples ({formatPercent(kpis.economiaMediaGlobal)}) e a
                    ponderada ({formatPercent(kpis.economiaPonderadaGlobal)}) reflete o peso das
                    grandes contratações diretas de serviços com desconto próximo de zero.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
