import React from 'react';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import type { DashboardFilters, Enabler7Data } from '../../types/dashboard';
import {
  formatCurrencyCompact,
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

interface Enabler7ViewProps {
  filters: DashboardFilters;
  onClearFilters: () => void;
}

const TRAINING_RECOMMENDATIONS = [
  {
    eixo: '01. Especificação Técnica & ETP (BAI02 / BAI03)',
    alvo: 'Equipes de Planejamento da Contratação e Requisitantes de TI',
    acao: 'Padronizar Estudos Técnicos Preliminares e Termos de Referência com pesquisa de preços realista para reduzir itens desertos e fracassados, especialmente em Materiais de TI.',
    indicador: 'Redução da taxa de deserto/fracasso/cancelamento',
  },
  {
    eixo: '02. Governança Catalográfica CATMAT / CATSER (APO11)',
    alvo: 'Agentes de Contratação e Pregoeiros',
    acao: 'Treinamento prático no enquadramento correto de códigos de TIC, bloqueando a classificação de itens alheios (ex.: fármacos ou obras) em grupos de tecnologia.',
    indicador: 'Eliminação de anomalias não-TI e erros cadastrais',
  },
  {
    eixo: '03. Dupla Validação de Valores e Unidades (MEA01)',
    alvo: 'Ordenadores de Despesa e Equipes de Apoio',
    acao: 'Protocolo de conferência de unidade de medida × quantidade antes da publicação no PNCP, prevenindo erros de ordem de grandeza (valores > R$ 1 bilhão).',
    indicador: 'Zero outliers críticos publicados sem revisão',
  },
  {
    eixo: '04. Compras Compartilhadas e Uso Estratégico de SRP (APO10)',
    alvo: 'Unidades Compradoras Descentralizadas (ex.: UASGs no TO)',
    acao: 'Capacitação em planejamento integrado (DFD/PCA) e adesão a Atas de Registro de Preços centralizadas, reduzindo a dependência de dispensas de baixa escala.',
    indicador: 'Aumento da participação de compras competitivas',
  },
];

export function Enabler7View({ filters, onClearFilters }: Enabler7ViewProps) {
  const { data, loading, error, refetch } = useDashboardApi<Enabler7Data>('/api/enabler/7', filters);

  if (loading && !data) return <SectionSkeleton />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!data) return null;

  const { byItemType, byOrgan, summary } = data;
  const isEmpty = summary.totalItensAvaliados === 0;
  const mat = byItemType.find((t) => t.tipo === 'Material');
  const srv = byItemType.find((t) => t.tipo === 'Serviço');

  const maxRate = Math.max(
    ...byOrgan.map((o) => Math.max(o.taxaFalha, o.taxaErroCadastro)),
    10
  );

  return (
    <div className="space-y-5">
      <CobitConceptBanner
        kicker="COBIT 5 · Habilitador 7 · Pessoas, Habilidades e Competências · Domínio BAI"
        title="Indicadores Indiretos de Capacitação Técnica na Especificação e no Cadastro"
        concept="Como os dados abertos não registram certificações dos servidores, o COBIT 5 permite inferir lacunas de competência por indicadores indiretos: altas taxas de itens desertos, fracassados ou cancelados refletem fragilidade na especificação/pesquisa de preços, enquanto erros cadastrais expõem déficit operacional no uso do PNCP."
        diagnosis={
          isEmpty
            ? 'Nenhum item encontrado para os filtros aplicados.'
            : `A taxa global de itens não concluídos (desertos, fracassados ou cancelados) atingiu ${formatPercent(
                summary.taxaFalhaGlobal
              )} (${formatNumber(
                summary.totalFalhas
              )} itens), sendo significativamente maior em Materiais (${formatPercent(
                mat?.taxaFalha ?? 0
              )}) do que em Serviços (${formatPercent(
                srv?.taxaFalha ?? 0
              )}). Somam-se ${formatNumber(
                summary.totalErrosCadastro
              )} registros com erro de cadastro sinalizado (${formatPercent(
                summary.taxaErroCadastroGlobal
              )}).`
        }
        emphasisTone="alert"
      />

      {isEmpty ? (
        <EmptyNotice
          title="Nenhum registro encontrado para os filtros aplicados"
          description="Altere os filtros para analisar as taxas de retrabalho e erros cadastrais por órgão e tipo de item."
          actionLabel="Limpar filtros"
          onAction={onClearFilters}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Taxa Global de Deserto / Fracasso / Canc."
              value={formatPercent(summary.taxaFalhaGlobal)}
              sublabel={`${formatNumber(summary.totalFalhas)} de ${formatNumber(
                summary.totalItensAvaliados
              )} itens`}
              tone="alert"
            />
            <KpiCard
              label="Taxa de Erro de Cadastro (Sinalizado)"
              value={formatPercent(summary.taxaErroCadastroGlobal)}
              sublabel={`${formatNumber(summary.totalErrosCadastro)} itens com inconsistência cadastral`}
              tone="alert"
            />
            <KpiCard
              label="Retrabalho em Materiais de TI"
              value={formatPercent(mat?.taxaFalha ?? 0)}
              sublabel={`Erro cadastro: ${formatPercent(mat?.taxaErroCadastro ?? 0)} · ${formatNumber(
                mat?.totalItens ?? 0
              )} itens`}
            />
            <KpiCard
              label="Retrabalho em Serviços de TIC"
              value={formatPercent(srv?.taxaFalha ?? 0)}
              sublabel={`Erro cadastro: ${formatPercent(srv?.taxaErroCadastro ?? 0)} · ${formatNumber(
                srv?.totalItens ?? 0
              )} itens`}
              tone="teal"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Ranking legível de órgãos com maior taxa de insucesso e erro de cadastro */}
            <Panel
              className="lg:col-span-7"
              title="Órgãos com Maior Taxa de Insucesso Licitatório e Erro de Cadastro"
              subtitle="Recorte de órgãos federais com volume relevante (≥ 100 itens no recorte geral), ordenados por retrabalho (%)"
            >
              <div className="divide-y divide-[#F1F5F9]">
                {byOrgan.map((org, idx) => {
                  const failWidth = Math.max(2, (org.taxaFalha / maxRate) * 100);
                  const errWidth =
                    org.taxaErroCadastro > 0
                      ? Math.max(2, (org.taxaErroCadastro / maxRate) * 100)
                      : 0;

                  return (
                    <div
                      key={org.orgao}
                      title={`${org.orgao} — Retrabalho: ${formatNumber(
                        org.falhasQtd
                      )}/${formatNumber(org.totalItens)} itens (${formatPercent(
                        org.taxaFalha
                      )}) · Erro cadastro: ${formatNumber(org.errosCadastroQtd)} (${formatPercent(
                        org.taxaErroCadastro
                      )}) · Volume: ${formatCurrencyCompact(org.valorEstimado)}`}
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
                          <span className="font-semibold text-[#C85A17]">
                            {formatPercent(org.taxaFalha)}
                          </span>
                          <span className="text-[#94A3B8] mx-1.5">·</span>
                          <span className="text-[#0F6B72] font-medium">
                            {formatPercent(org.taxaErroCadastro)} erro
                          </span>
                        </div>
                      </div>

                      <div className="mt-1.5 pl-[30px] flex items-center gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#C85A17] rounded-full transition-all duration-300"
                              style={{ width: `${failWidth}%` }}
                            />
                          </div>
                          {errWidth > 0 ? (
                            <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#0F6B72] rounded-full transition-all duration-300"
                                style={{ width: `${errWidth}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-[#64748B] whitespace-nowrap shrink-0">
                          {formatNumber(org.falhasQtd)}/{formatNumber(org.totalItens)} itens
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center gap-5 text-xs text-[#64748B]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#C85A17]" />
                  Desertos / Fracassados / Cancelados (%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0F6B72]" />
                  Erro de Cadastro Sinalizado (%)
                </span>
              </div>
            </Panel>

            {/* Plano Estruturado de Capacitação */}
            <Panel
              className="lg:col-span-5"
              title="Trilha Estruturada de Capacitação (Domínio BAI)"
              subtitle="Recomendações diretas vinculadas às fragilidades observadas nos dados de 2025"
            >
              <div className="divide-y divide-[#E2E8F0]">
                {TRAINING_RECOMMENDATIONS.map((rec) => (
                  <div key={rec.eixo} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                    <div className="text-xs font-semibold text-[#0F6B72]">{rec.eixo}</div>
                    <div className="text-[11.5px] font-medium text-[#0F172A]">
                      Público: {rec.alvo}
                    </div>
                    <p className="text-xs text-[#334155] leading-relaxed">{rec.acao}</p>
                    <div className="text-[11px] text-[#64748B]">
                      Meta operacional:{' '}
                      <span className="font-medium text-[#0F172A]">{rec.indicador}</span>
                    </div>
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
