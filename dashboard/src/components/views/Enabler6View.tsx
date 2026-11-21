import React from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import type { DashboardFilters, Enabler6Data } from '../../types/dashboard';
import {
  formatCurrencyCompact,
  formatCurrencyFull,
  formatEntityName,
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

interface Enabler6ViewProps {
  filters: DashboardFilters;
  onClearFilters: () => void;
}

export function Enabler6View({ filters, onClearFilters }: Enabler6ViewProps) {
  const { data, loading, error, refetch } = useDashboardApi<Enabler6Data>('/api/enabler/6', filters);

  if (loading && !data) return <SectionSkeleton />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!data) return null;

  const { apiPerformance, apiSummary, mixTi, topCatalogo } = data;
  const servicos = mixTi.find((m) => m.tipo === 'Serviço');
  const materiais = mixTi.find((m) => m.tipo === 'Material');

  const maxCatalogVal = Math.max(...topCatalogo.map((c) => c.valorEstimado), 1);

  return (
    <div className="space-y-5">
      <CobitConceptBanner
        kicker="COBIT 5 · Habilitador 6 · Serviços, Infraestrutura e Aplicativos · DSS01 / APO09"
        title="Infraestrutura da API Aberta Compras.gov.br e Composição Tecnológica do Gasto"
        concept="Este habilitador avalia tanto a capacidade da infraestrutura digital que publica os dados abertos (API Compras.gov.br — volume, disponibilidade e latência) quanto o portfólio de serviços e equipamentos de TIC contratados pelo Governo Federal."
        diagnosis={`A latência média da API degradou ${apiSummary.fatorDegradacao
          .toFixed(1)
          .replace('.', ',')}× ao longo de 2025 — saindo de ${formatNumber(
          apiSummary.latenciaInicialMs,
          0
        )} ms em abril para ${formatNumber(
          apiSummary.latenciaFinalMs,
          0
        )} ms em dezembro — mesmo após o pico de requisições ocorrer em ${
          apiSummary.picoRequisicoesMes
        }. No portfólio adquirido, Serviços de TIC representam ${formatPercent(
          servicos?.pctValor ?? 0
        )} do valor total (${formatCurrencyCompact(servicos?.valorEstimado ?? 0)}).`}
        emphasisTone="alert"
      />

      {/* 4 KPIs de Infraestrutura e Mix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Latência Média da API (Dez/2025)"
          value={`${formatNumber(apiSummary.latenciaFinalMs, 0)} ms`}
          sublabel={`Degradação de ${apiSummary.fatorDegradacao
            .toFixed(1)
            .replace('.', ',')}× frente a Abr/25 (${formatNumber(apiSummary.latenciaInicialMs, 0)} ms)`}
          tone="alert"
        />
        <KpiCard
          label={`Pico de Requisições (${apiSummary.picoRequisicoesMes}/2025)`}
          value={`${formatNumber(apiSummary.picoRequisicoes / 1e6, 2)} mi`}
          sublabel={`Download acumulado: ${formatNumber(apiSummary.totalDownloadGbAno, 0)} GB`}
          tone="teal"
        />
        <KpiCard
          label="Serviços de TIC (CATSER)"
          value={formatCurrencyCompact(servicos?.valorEstimado ?? 0)}
          sublabel={`${formatPercent(servicos?.pctValor ?? 0)} do valor · ${formatNumber(
            servicos?.itens ?? 0
          )} itens`}
          tone="teal"
        />
        <KpiCard
          label="Materiais de TI (CATMAT)"
          value={formatCurrencyCompact(materiais?.valorEstimado ?? 0)}
          sublabel={`${formatPercent(materiais?.pctValor ?? 0)} do valor · ${formatNumber(
            materiais?.itens ?? 0
          )} itens`}
        />
      </div>

      {/* Gráfico Combinado de Desempenho da API + Top CATMAT/CATSER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <Panel
          className="lg:col-span-6"
          title="Desempenho da API Compras.gov.br (Abr–Dez 2025)"
          subtitle="Volume mensal de requisições (barras) vs. Tempo médio de resposta em ms (linha laranja)"
        >
          <div className="flex-1 min-h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={apiPerformance}
                margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#334155', fontSize: 12 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => `${(Number(v) / 1e6).toFixed(0)}M`}
                  tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => `${v}ms`}
                  tick={{ fill: '#C85A17', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={58}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as Enabler6Data['apiPerformance'][number];
                    return (
                      <div className="bg-white border border-[#CBD5E1] rounded-lg p-3 shadow-md text-xs space-y-1">
                        <div className="font-semibold text-[#0F172A]">{row.anoMes}</div>
                        <div className="font-mono tabular-nums text-[#C85A17] font-semibold">
                          Tempo médio: {formatNumber(row.mediaTempoRespostaMs, 1)} ms
                        </div>
                        <div className="font-mono tabular-nums text-[#0F6B72]">
                          Requisições: {formatNumber(row.totalRequisicoes)}
                        </div>
                        <div className="font-mono tabular-nums text-[#334155]">
                          Sucesso: {formatPercent(row.percentualSucesso, 2)} · Download:{' '}
                          {formatNumber(row.totalDownloadGb, 1)} GB
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(v) =>
                    v === 'totalRequisicoes'
                      ? 'Volume de Requisições'
                      : 'Tempo Médio de Resposta (ms)'
                  }
                />
                <Bar
                  yAxisId="left"
                  dataKey="totalRequisicoes"
                  fill="#0F6B72"
                  fillOpacity={0.28}
                  stroke="#0F6B72"
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="mediaTempoRespostaMs"
                  stroke="#C85A17"
                  strokeWidth={2.75}
                  dot={{ r: 4, fill: '#C85A17', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 pt-3 border-t border-[#E2E8F0] text-xs text-[#64748B] leading-relaxed">
            A degradação acentuada entre outubro (527 ms), novembro (1.088 ms) e dezembro (1.480 ms)
            coincide com o pico de contratações de fim de exercício e expansão para 71 serviços na API.
          </p>
        </Panel>

        <Panel
          className="lg:col-span-6"
          title="Top 10 Grupos CATSER e Classes CATMAT Mais Contratados"
          subtitle="Valor estimado (R$) e participação por categoria oficial de TI do catálogo Compras.gov.br"
        >
          {topCatalogo.length === 0 ? (
            <EmptyNotice
              title="Sem categorias para os filtros atuais"
              description="Limpe os filtros para visualizar os principais grupos CATSER e classes CATMAT."
              actionLabel="Limpar filtros"
              onAction={onClearFilters}
            />
          ) : (
            <>
              <div className="divide-y divide-[#F1F5F9]">
                {topCatalogo.map((cat, idx) => {
                  const widthPct = Math.max(3, (cat.valorEstimado / maxCatalogVal) * 100);
                  const isServico = cat.tipo === 'Serviço';

                  return (
                    <div
                      key={cat.codigo}
                      title={`${cat.codigo} — ${cat.nome} · Estimado: ${formatCurrencyFull(
                        cat.valorEstimado
                      )} (${formatNumber(cat.itens)} itens)`}
                      className="py-2.5 first:pt-0.5 last:pb-0.5 px-2 -mx-2 rounded-lg hover:bg-[#F8FAFC] transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="font-mono text-xs text-[#94A3B8] tabular-nums w-5 shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span
                            className={`font-mono text-[11px] font-semibold shrink-0 ${
                              isServico ? 'text-[#0F6B72]' : 'text-[#C85A17]'
                            }`}
                          >
                            {cat.codigo}
                          </span>
                          <span className="text-[12.5px] font-medium text-[#0F172A] truncate">
                            {formatEntityName(cat.nome)}
                          </span>
                        </div>
                        <div className="font-mono tabular-nums text-xs shrink-0 text-right">
                          <span className="font-semibold text-[#0F172A]">
                            {formatCurrencyCompact(cat.valorEstimado)}
                          </span>
                          <span className="text-[#64748B] ml-1.5">
                            {formatPercent(cat.pctValor)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1.5 pl-[28px] flex items-center gap-3">
                        <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: isServico ? '#0F6B72' : '#C85A17',
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-[#64748B] whitespace-nowrap shrink-0">
                          {formatNumber(cat.itens)} itens
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center gap-5 text-xs text-[#64748B]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0F6B72]" />
                  CATSER · Serviços de TIC
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#C85A17]" />
                  CATMAT · Materiais / Equipamentos de TI
                </span>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
