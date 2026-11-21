import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import type { DashboardFilters, Enabler4Data } from '../../types/dashboard';
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

interface Enabler4ViewProps {
  filters: DashboardFilters;
  onClearFilters: () => void;
}

export function Enabler4View({ filters, onClearFilters }: Enabler4ViewProps) {
  const { data, loading, error, refetch } = useDashboardApi<Enabler4Data>('/api/enabler/4', filters);

  if (loading && !data) return <SectionSkeleton />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!data) return null;

  const { supplierConcentration, top10Suppliers, dispensaHistogram, dispensaSummary } = data;
  const isEmpty =
    supplierConcentration.totalFornecedoresDistintos === 0 &&
    dispensaSummary.totalDispensasComTeto === 0;

  const maxSupplierValue = Math.max(...top10Suppliers.map((s) => s.valorHomologado), 1);

  return (
    <div className="space-y-5">
      <CobitConceptBanner
        kicker="COBIT 5 · Habilitador 4 · Cultura, Ética e Comportamento · Art. 75, II (Lei nº 14.133/2021)"
        title="Concentração de Fornecedores e Indícios Comportamentais de Fracionamento"
        concept="A cultura e o comportamento organizacional influenciam diretamente o uso íntegro das regras de contratação. A análise examina dois fenômenos sensíveis: a concentração econômica em poucos fornecedores (incluindo empresas públicas de TI) e o acúmulo atípico de dispensas logo abaixo do teto legal."
        diagnosis={
          isEmpty
            ? 'Sem dados para os filtros selecionados.'
            : `Os 10 maiores fornecedores concentram ${formatPercent(
                supplierConcentration.top10Pct
              )} de todo o valor homologado (${formatNumber(
                supplierConcentration.totalFornecedoresDistintos
              )} fornecedores distintos). Nas dispensas federais, observa-se salto de ${dispensaSummary.razaoSalto90vs80
                .toFixed(2)
                .replace('.', ',')}× entre a faixa 80–90% (${formatNumber(
                dispensaSummary.qtdFaixa80a90
              )}) e a faixa crítica 90–100% (${formatNumber(
                dispensaSummary.qtdFaixa90a100
              )} processos), evidenciando indício de fracionamento próximo ao teto.`
        }
        emphasisTone="alert"
      />

      {isEmpty ? (
        <EmptyNotice
          title="Nenhum fornecedor ou dispensa para os filtros atuais"
          description="Altere os filtros globais para inspecionar concentração de mercado e distribuição de dispensas."
          actionLabel="Limpar filtros"
          onAction={onClearFilters}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Concentração nos Top 10 Fornecedores"
              value={formatPercent(supplierConcentration.top10Pct)}
              sublabel={`${formatCurrencyCompact(supplierConcentration.top10Valor)} de ${formatCurrencyCompact(
                supplierConcentration.valorHomologadoTotal
              )}`}
              tone="teal"
            />
            <KpiCard
              label="Fornecedores Distintos Homologados"
              value={formatNumber(supplierConcentration.totalFornecedoresDistintos)}
              sublabel={`Empresas públicas de TI no Top 10: ${formatPercent(
                supplierConcentration.empresasPublicasPct
              )}`}
            />
            <KpiCard
              label="Dispensas na Faixa Crítica (90–100%)"
              value={formatNumber(dispensaSummary.qtdFaixa90a100)}
              sublabel={`Salto de ${dispensaSummary.razaoSalto90vs80.toFixed(2).replace('.', ',')}× frente à faixa 80–90% (${formatNumber(
                dispensaSummary.qtdFaixa80a90
              )})`}
              tone="alert"
            />
            <KpiCard
              label="Dispensas Acima do Teto Art. 75, II"
              value={formatNumber(dispensaSummary.qtdAcimaTeto)}
              sublabel={`Outras hipóteses legais · Total: ${formatNumber(
                dispensaSummary.totalDispensasComTeto
              )}`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Ranking Top 10 Fornecedores — Layout de leitura clara (2 linhas por item) */}
            <Panel
              className="lg:col-span-7"
              title="Ranking Top 10 Fornecedores por Valor Homologado"
              subtitle="Nomes legíveis com valor exato e participação percentual — passe o cursor sobre cada linha para a razão social completa"
            >
              <div className="divide-y divide-[#F1F5F9]">
                {top10Suppliers.map((supplier, index) => {
                  const widthPct = Math.max(
                    3,
                    (supplier.valorHomologado / maxSupplierValue) * 100
                  );
                  const barColor = supplier.isClassificationAnomaly
                    ? '#C85A17'
                    : supplier.isPublicTech
                      ? '#0F6B72'
                      : '#475569';
                  const categoryNote = supplier.isClassificationAnomaly
                    ? 'Anomalia · Fármaco em CATSER 182'
                    : supplier.isPublicTech
                      ? 'Empresa pública de TI'
                      : 'Fornecedor privado';

                  return (
                    <div
                      key={supplier.nomeFornecedor}
                      title={`${supplier.nomeFornecedor} — Homologado: ${formatCurrencyFull(
                        supplier.valorHomologado
                      )} (${formatNumber(supplier.itens)} itens)`}
                      className="py-2.5 first:pt-0.5 last:pb-0.5 px-2 -mx-2 rounded-lg hover:bg-[#F8FAFC] transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="flex items-baseline gap-2.5 min-w-0">
                          <span className="font-mono text-xs text-[#94A3B8] tabular-nums w-5 shrink-0">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[13px] font-medium text-[#0F172A] truncate">
                            {formatEntityName(supplier.nomeFornecedor)}
                          </span>
                        </div>
                        <div className="font-mono tabular-nums text-xs shrink-0 text-right">
                          <span className="font-semibold text-[#0F172A]">
                            {formatCurrencyCompact(supplier.valorHomologado)}
                          </span>
                          <span className="text-[#64748B] ml-2">
                            {formatPercent(supplier.pctTotal)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1.5 pl-[30px] flex items-center gap-3">
                        <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                          />
                        </div>
                        <span
                          className={`text-[11px] whitespace-nowrap shrink-0 ${
                            supplier.isClassificationAnomaly
                              ? 'text-[#C85A17] font-medium'
                              : supplier.isPublicTech
                                ? 'text-[#0F6B72] font-medium'
                                : 'text-[#64748B]'
                          }`}
                        >
                          {categoryNote} · {formatNumber(supplier.itens)} itens
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#64748B]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0F6B72]" />
                  Empresas públicas de TI
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#475569]" />
                  Fornecedores privados de TIC
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#C85A17]" />
                  Anomalia catalográfica (não-TI)
                </span>
              </div>
            </Panel>

            {/* Histograma de Indício de Fracionamento */}
            <Panel
              className="lg:col-span-5"
              title="Indício de Fracionamento de Despesa (Art. 75, II)"
              subtitle="Número de dispensas por faixa percentual em relação ao teto legal — alerta no salto de 90–100%"
            >
              <div className="flex-1 min-h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dispensaHistogram}
                    barCategoryGap="22%"
                    margin={{ top: 28, right: 16, left: 4, bottom: 12 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="faixa"
                      interval={0}
                      height={54}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                      tick={(props: {
                        x?: number | string;
                        y?: number | string;
                        payload?: { value?: string };
                      }) => {
                        const x = Number(props.x ?? 0);
                        const y = Number(props.y ?? 0);
                        const raw = String(props.payload?.value ?? '');
                        const label = raw === 'Acima do teto' ? '> 100%' : raw;
                        const isAlert = raw === '90–100%';
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={0}
                              dy={12}
                              textAnchor="end"
                              transform="rotate(-32)"
                              fill={isAlert ? '#C85A17' : '#334155'}
                              fontSize={11}
                              fontFamily="IBM Plex Mono, monospace"
                              fontWeight={isAlert ? 600 : 500}
                            >
                              {label}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <YAxis
                      tickFormatter={(v) => formatNumber(Number(v))}
                      tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                      axisLine={false}
                      tickLine={false}
                      dx={-4}
                      width={54}
                    />
                    <Tooltip
                      cursor={{ fill: '#F8FAFC' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as Enabler4Data['dispensaHistogram'][number];
                        return (
                          <div className="bg-white border border-[#CBD5E1] rounded-lg p-3 shadow-md text-xs space-y-1">
                            <div className="font-semibold text-[#0F172A]">
                              Faixa {row.faixa} do teto legal
                              {row.isAlertBucket ? ' — Zona de Alerta' : ''}
                            </div>
                            <div className="font-mono tabular-nums font-semibold text-[#0F6B72]">
                              {formatNumber(row.quantidade)} dispensas ({formatPercent(row.pct)})
                            </div>
                            <div className="font-mono tabular-nums text-[#64748B]">
                              Soma estimada: {formatCurrencyCompact(row.valorEstimado)}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="quantidade" radius={[4, 4, 0, 0]} maxBarSize={36}>
                      <LabelList
                        dataKey="quantidade"
                        position="top"
                        offset={8}
                        content={(props) => {
                          const x = Number(props.x ?? 0);
                          const y = Number(props.y ?? 0);
                          const width = Number(props.width ?? 0);
                          const val = Number(props.value ?? 0);
                          const idx = typeof props.index === 'number' ? props.index : -1;
                          const isAlert = idx >= 0 && dispensaHistogram[idx]?.isAlertBucket;
                          return (
                            <text
                              x={x + width / 2}
                              y={y - 7}
                              textAnchor="middle"
                              fill={isAlert ? '#C85A17' : '#334155'}
                              fontSize={10.5}
                              fontFamily="IBM Plex Mono, monospace"
                              fontWeight={isAlert ? 600 : 500}
                            >
                              {formatNumber(val)}
                            </text>
                          );
                        }}
                      />
                      {dispensaHistogram.map((b) => (
                        <Cell
                          key={b.faixa}
                          fill={
                            b.isAlertBucket
                              ? '#C85A17'
                              : b.faixa === 'Acima do teto'
                                ? '#94A3B8'
                                : '#0F6B72'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 pt-3 border-t border-[#E2E8F0] text-xs text-[#64748B] leading-relaxed">
                O padrão decrescente esperado se rompe exatamente em{' '}
                <strong className="text-[#C85A17]">90–100%</strong> (
                {formatNumber(dispensaSummary.qtdFaixa90a100)} processos vs.{' '}
                {formatNumber(dispensaSummary.qtdFaixa80a90)} em 80–90%), sinalizando acúmulo de
                compras logo abaixo do teto de dispensa por valor (&gt;100% = demais hipóteses).
              </p>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
