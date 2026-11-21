import React from 'react';
import { FileWarning } from 'lucide-react';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import type { DashboardFilters, Enabler3Data } from '../../types/dashboard';
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

interface Enabler3ViewProps {
  filters: DashboardFilters;
  onClearFilters: () => void;
}

export function Enabler3View({ filters, onClearFilters }: Enabler3ViewProps) {
  const { data, loading, error, refetch } = useDashboardApi<Enabler3Data>('/api/enabler/3', filters);

  if (loading && !data) return <SectionSkeleton />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!data) return null;

  const { kpis, topOrgaosTO, pcaStatus } = data;
  const isEmpty = kpis.totalContratacoesTO === 0;
  const scaleRatio =
    kpis.ticketMedioTO > 0 ? kpis.ticketMedioNacional / kpis.ticketMedioTO : 0;

  const maxCompras = Math.max(...topOrgaosTO.map((o) => o.compras), 1);

  return (
    <div className="space-y-5">
      <CobitConceptBanner
        kicker="COBIT 5 · Habilitador 3 · Estruturas Organizacionais · Recorte Tocantins (UF = TO)"
        title="Fragmentação das Unidades Compradoras Federais e Baixa Escala Local"
        concept="Estruturas organizacionais definem as entidades-chave de tomada de decisão. Quando unidades federais descentralizadas compram TI isoladamente sem centrais de compra ou adesão coordenada a atas (SRP), perdem escala e recorrem com maior frequência à contratação direta."
        diagnosis={
          isEmpty
            ? 'Nenhuma contratação federal no Tocantins corresponde aos filtros aplicados.'
            : `As unidades federais no Tocantins realizaram ${formatNumber(
                kpis.totalContratacoesTO
              )} contratações (${formatNumber(kpis.totalItensTO)} itens), sendo ${formatPercent(
                kpis.pctDiretasTO
              )} por contratação direta (${formatNumber(
                kpis.qtdDiretasTO
              )} processos). O valor médio por contratação no TO (${formatCurrencyCompact(
                kpis.ticketMedioTO
              )}) é ${scaleRatio.toFixed(1).replace('.', ',')}× menor que a média nacional (${formatCurrencyCompact(
                kpis.ticketMedioNacional
              )}).`
        }
        emphasisTone="alert"
      />

      {isEmpty ? (
        <EmptyNotice
          title="Sem registros no Tocantins para os filtros aplicados"
          description="Alguns órgãos ou modalidades não possuem contratações registradas na UF Tocantins."
          actionLabel="Limpar filtros"
          onAction={onClearFilters}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Total de Contratações no TO"
              value={formatNumber(kpis.totalContratacoesTO)}
              sublabel={`${formatNumber(kpis.totalItensTO)} itens · Est. ${formatCurrencyCompact(
                kpis.valorEstimadoTO
              )}`}
              tone="teal"
            />
            <KpiCard
              label="% de Contratações Diretas no TO"
              value={formatPercent(kpis.pctDiretasTO)}
              sublabel={`${formatNumber(kpis.qtdDiretasTO)} diretas de ${formatNumber(
                kpis.totalContratacoesTO
              )} processos`}
              tone="alert"
            />
            <KpiCard
              label="Economia Média no TO"
              value={formatPercent(kpis.economiaMediaTO)}
              sublabel={`Economia ponderada: ${formatPercent(kpis.economiaPonderadaTO)}`}
              tone="teal"
            />
            <KpiCard
              label="Escala Média por Contratação (TO)"
              value={formatCurrencyCompact(kpis.ticketMedioTO)}
              sublabel={`Média nacional: ${formatCurrencyCompact(kpis.ticketMedioNacional)}`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Ranking legível dos principais órgãos federais no TO */}
            <Panel
              className="lg:col-span-8"
              title="Principais Órgãos Federais no Tocantins (Diretas vs. Competitivas)"
              subtitle="Número de contratações de TI em 2025 por órgão comprador localizado no TO, detalhando a proporção de compras diretas"
            >
              <div className="divide-y divide-[#F1F5F9]">
                {topOrgaosTO.map((org, idx) => {
                  const totalWidthPct = Math.max(4, (org.compras / maxCompras) * 100);
                  const dirRatio = org.compras > 0 ? (org.comprasDiretas / org.compras) * 100 : 0;
                  const compRatio = 100 - dirRatio;

                  return (
                    <div
                      key={org.orgao}
                      title={`${org.orgao} — ${formatNumber(org.compras)} contratações (${formatNumber(
                        org.comprasDiretas
                      )} diretas, ${formatNumber(org.comprasCompetitivas)} competitivas) · Estimado: ${formatCurrencyFull(
                        org.valorEstimado
                      )}`}
                      className="py-2.5 first:pt-0.5 last:pb-0.5 px-2 -mx-2 rounded-lg hover:bg-[#F8FAFC] transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="flex items-baseline gap-2.5 min-w-0">
                          <span className="font-mono text-xs text-[#94A3B8] tabular-nums w-5 shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[13px] font-medium text-[#0F172A] truncate">
                            {formatEntityName(org.orgao)}
                          </span>
                        </div>
                        <div className="font-mono tabular-nums text-xs shrink-0 text-right">
                          <span className="font-semibold text-[#0F172A]">
                            {formatNumber(org.compras)} compras
                          </span>
                          <span className="text-[#64748B] ml-2">
                            {formatCurrencyCompact(org.valorEstimado)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1.5 pl-[30px] flex items-center gap-3">
                        <div className="flex-1 h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div
                            className="h-full flex rounded-full overflow-hidden transition-all duration-300"
                            style={{ width: `${totalWidthPct}%` }}
                          >
                            {dirRatio > 0 ? (
                              <div
                                className="h-full bg-[#C85A17]"
                                style={{ width: `${dirRatio}%` }}
                              />
                            ) : null}
                            {compRatio > 0 ? (
                              <div
                                className="h-full bg-[#0F6B72]"
                                style={{ width: `${compRatio}%` }}
                              />
                            ) : null}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums whitespace-nowrap shrink-0">
                          <span className="text-[#C85A17] font-medium">
                            {formatNumber(org.comprasDiretas)} diretas ({formatPercent(org.pctDiretas, 0)})
                          </span>
                          <span className="text-[#94A3B8] mx-1.5">·</span>
                          <span className="text-[#0F6B72]">
                            {formatNumber(org.comprasCompetitivas)} comp.
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center gap-5 text-xs text-[#64748B]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#C85A17]" />
                  Contratação Direta (Dispensa / Inexigibilidade)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0F6B72]" />
                  Com Competição (Pregão Eletrônico)
                </span>
              </div>
            </Panel>

            {/* Card de Governança sobre fato_pca_to + Detalhe Financeiro */}
            <Panel
              className="lg:col-span-4"
              title="Planejamento Anual (PCA) no Tocantins"
              subtitle="Auditoria da tabela fato_pca_to e aderência ao planejamento integrado"
            >
              <div className="flex flex-col justify-between h-full gap-5">
                {pcaStatus.disponivel ? (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-[#0F6B72]">
                      Dados do PCA disponíveis no banco
                    </div>
                    <div className="text-2xl font-semibold font-mono tabular-nums text-[#0F172A]">
                      {formatCurrencyCompact(pcaStatus.valorPlanejadoTotal)}
                    </div>
                    <p className="text-xs text-[#334155]">
                      {formatNumber(pcaStatus.totalRegistros)} itens planejados por{' '}
                      {formatNumber(pcaStatus.orgaosComPca)} órgãos no Tocantins frente a{' '}
                      {formatCurrencyCompact(kpis.valorEstimadoTO)} efetivamente executados em 2025.
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#FDF8F5] border border-[#F3D5C2] rounded-xl p-4 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <FileWarning className="w-4 h-4 text-[#C85A17] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-[#C85A17]">
                          Achado de Governança · Base PCA-TO Vazia
                        </div>
                        <div className="mt-1 font-mono tabular-nums text-lg font-semibold text-[#0F172A]">
                          0 registros em fato_pca_to
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-[#334155] leading-relaxed">
                      A tabela <span className="font-mono text-[11px]">fato_pca_to</span> não
                      retornou registros populados na extração de dados abertos. Essa lacuna impede
                      o cotejamento automatizado entre o <strong>Planejado (PCA)</strong> e o{' '}
                      <strong>Executado (PNCP)</strong> pelas unidades federais no Tocantins.
                    </p>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Impacto COBIT 5 (APO02/APO10): sem integração estruturada entre DFD/PCA e as
                      compras executadas, as UASGs perdem visibilidade para consolidar demandas
                      comuns de TI em pregões compartilhados.
                    </p>
                  </div>
                )}

                <div className="border-t border-[#E2E8F0] pt-4 space-y-2.5">
                  <div className="text-xs font-semibold text-[#0F172A]">
                    Maiores Volumes Financeiros no TO
                  </div>
                  <div className="space-y-2.5">
                    {[...topOrgaosTO]
                      .sort((a, b) => b.valorEstimado - a.valorEstimado)
                      .slice(0, 5)
                      .map((org) => (
                        <div key={org.orgao} className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="text-[#334155] truncate" title={org.orgao}>
                            {formatEntityName(org.orgao)}
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-[#0F172A] shrink-0">
                            {formatCurrencyCompact(org.valorEstimado)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
