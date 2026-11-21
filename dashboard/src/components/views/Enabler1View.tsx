import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import type { DashboardFilters, Enabler1Data } from '../../types/dashboard';
import {
  formatCurrencyCompact,
  formatCurrencyFull,
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

interface Enabler1ViewProps {
  filters: DashboardFilters;
  onClearFilters: () => void;
}

export function Enabler1View({ filters, onClearFilters }: Enabler1ViewProps) {
  const [metric, setMetric] = useState<'valor' | 'quantidade'>('valor');
  const { data, loading, error, refetch } = useDashboardApi<Enabler1Data>('/api/enabler/1', filters);

  if (loading && !data) return <SectionSkeleton />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!data) return null;

  const isEmpty = data.comparison.length === 0;
  const compRow = data.comparison.find((c) => c.grupo === 'Com Competição');
  const dirRow = data.comparison.find((c) => c.grupo === 'Contratação Direta');

  const donutData = data.comparison.map((row) => ({
    name: row.grupo,
    value: metric === 'valor' ? row.valorEstimado : row.qtdContratacoes,
    pct: metric === 'valor' ? row.pctValor : row.pctContratacoes,
    valorEstimado: row.valorEstimado,
    qtdContratacoes: row.qtdContratacoes,
    qtdItens: row.qtdItens,
    color: row.grupo === 'Com Competição' ? '#0F6B72' : '#C85A17',
  }));

  return (
    <div className="space-y-5">
      <CobitConceptBanner
        kicker="COBIT 5 · Habilitador 1 · Princípios, Políticas e Modelos · Lei nº 14.133/2021"
        title="Conformidade Prática com a Regra Geral de Licitação Competitiva"
        concept="No COBIT 5, Princípios, Políticas e Modelos traduzem o comportamento desejado pela alta direção em diretrizes práticas. A Lei nº 14.133/2021 estabelece a licitação competitiva como regra geral e a contratação direta (Dispensa e Inexigibilidade) como exceção estrita."
        diagnosis={
          isEmpty
            ? 'Nenhum dado disponível para os filtros atuais.'
            : `Na prática operacional de 2025, a exceção superou a regra em volume de processos: ${formatPercent(
                data.summary.pctDiretaContratacoes
              )} das contratações federais de TI ocorreram de forma direta (${formatPercent(
                data.summary.pctDiretaValor
              )} do valor estimado), enquanto apenas ${formatPercent(
                data.summary.pctCompetitivaContratacoes
              )} utilizaram disputa competitiva (${formatPercent(
                data.summary.pctCompetitivaValor
              )} do valor).`
        }
        emphasisTone="alert"
      />

      {isEmpty ? (
        <EmptyNotice
          title="Sem contratações para os filtros selecionados"
          description="Limpe ou altere os filtros globais para comparar modalidades competitivas e contratações diretas."
          actionLabel="Limpar filtros"
          onAction={onClearFilters}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Com Competição (Valor Estimado)"
              value={formatCurrencyCompact(compRow?.valorEstimado ?? 0)}
              sublabel={`${formatPercent(data.summary.pctCompetitivaValor)} do valor total`}
              tone="teal"
            />
            <KpiCard
              label="Contratação Direta (Valor Estimado)"
              value={formatCurrencyCompact(dirRow?.valorEstimado ?? 0)}
              sublabel={`${formatPercent(data.summary.pctDiretaValor)} do valor total`}
              tone="alert"
            />
            <KpiCard
              label="Com Competição (Processos)"
              value={formatNumber(compRow?.qtdContratacoes ?? 0)}
              sublabel={`${formatPercent(data.summary.pctCompetitivaContratacoes)} das contratações · ${formatNumber(
                compRow?.qtdItens ?? 0
              )} itens`}
              tone="teal"
            />
            <KpiCard
              label="Contratação Direta (Processos)"
              value={formatNumber(dirRow?.qtdContratacoes ?? 0)}
              sublabel={`${formatPercent(data.summary.pctDiretaContratacoes)} das contratações · ${formatNumber(
                dirRow?.qtdItens ?? 0
              )} itens`}
              tone="alert"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Donut Comparativo Alternável */}
            <Panel
              className="lg:col-span-5"
              title="Com Competição vs. Contratação Direta"
              subtitle="Alterne entre volume financeiro (R$) e quantidade de processos licitatórios"
              headerRight={
                <div className="inline-flex items-center p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMetric('valor')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      metric === 'valor'
                        ? 'bg-white text-[#0F6B72] shadow-xs'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Valor (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('quantidade')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      metric === 'quantidade'
                        ? 'bg-white text-[#0F6B72] shadow-xs'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Contratações
                  </button>
                </div>
              }
            >
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={64}
                      outerRadius={98}
                      paddingAngle={2}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as (typeof donutData)[number];
                        return (
                          <div className="bg-white border border-[#CBD5E1] rounded-lg p-3 shadow-md text-xs space-y-1">
                            <div className="font-semibold text-[#0F172A]">{d.name}</div>
                            <div className="font-mono tabular-nums text-[#334155]">
                              Valor estimado: {formatCurrencyFull(d.valorEstimado)}
                            </div>
                            <div className="font-mono tabular-nums text-[#334155]">
                              Contratações: {formatNumber(d.qtdContratacoes)} ({formatNumber(d.qtdItens)} itens)
                            </div>
                            <div className="font-mono tabular-nums font-semibold text-[#0F6B72]">
                              Participação: {formatPercent(d.pct)}
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 pt-3 border-t border-[#F1F5F9] space-y-2.5">
                {donutData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[#334155] font-medium">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <div className="font-mono tabular-nums text-[#0F172A] font-semibold">
                      {metric === 'valor'
                        ? formatCurrencyCompact(item.valorEstimado)
                        : `${formatNumber(item.qtdContratacoes)} compras`}{' '}
                      <span className="text-[#64748B] font-normal">
                        ({formatPercent(item.pct)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Barras Horizontais por Modalidade */}
            <Panel
              className="lg:col-span-7"
              title="Distribuição Detalhada por Modalidade de Contratação"
              subtitle="Valor estimado (R$) e participação percentual por modalidade da Lei nº 14.133/2021"
            >
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.byModality}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 10, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCurrencyCompact(Number(v))}
                      tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="modalidade"
                      width={158}
                      tick={{ fill: '#0F172A', fontSize: 12, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#F8FAFC' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as Enabler1Data['byModality'][number];
                        return (
                          <div className="bg-white border border-[#CBD5E1] rounded-lg p-3 shadow-md text-xs space-y-1">
                            <div className="font-semibold text-[#0F172A]">
                              {row.modalidade} · {row.tipoContratacao}
                            </div>
                            <div className="font-mono tabular-nums">
                              Estimado: {formatCurrencyFull(row.valorEstimado)} ({formatPercent(row.pctValor)})
                            </div>
                            <div className="font-mono tabular-nums">
                              Homologado: {formatCurrencyFull(row.valorHomologado)}
                            </div>
                            <div className="font-mono tabular-nums text-[#64748B]">
                              {formatNumber(row.qtdContratacoes)} contratações ({formatPercent(row.pctContratacoes)}) · {formatNumber(row.qtdItens)} itens
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="valorEstimado" radius={[0, 5, 5, 0]} barSize={28}>
                      {data.byModality.map((m) => (
                        <Cell
                          key={m.modalidade}
                          fill={m.tipoContratacao === 'Com Competição' ? '#0F6B72' : '#C85A17'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela sintética limpa abaixo do gráfico */}
              <div className="mt-4 pt-3 border-t border-[#E2E8F0] overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[#64748B] border-b border-[#E2E8F0]">
                      <th className="py-2 font-medium">Modalidade</th>
                      <th className="py-2 font-medium">Regime</th>
                      <th className="py-2 font-medium text-right">Contratações</th>
                      <th className="py-2 font-medium text-right">Valor Estimado</th>
                      <th className="py-2 font-medium text-right">% Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {data.byModality.map((row) => (
                      <tr key={row.modalidade} className="hover:bg-[#F8FAFC]">
                        <td className="py-2 font-medium text-[#0F172A]">{row.modalidade}</td>
                        <td
                          className={`py-2 font-medium ${
                            row.tipoContratacao === 'Com Competição'
                              ? 'text-[#0F6B72]'
                              : 'text-[#C85A17]'
                          }`}
                        >
                          {row.tipoContratacao}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-[#334155]">
                          {formatNumber(row.qtdContratacoes)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-[#0F172A]">
                          {formatCurrencyCompact(row.valorEstimado)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums font-semibold text-[#0F172A]">
                          {formatPercent(row.pctValor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
