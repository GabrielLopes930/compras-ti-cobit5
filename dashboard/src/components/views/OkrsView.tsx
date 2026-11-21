import React from 'react';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import type { OkrsData } from '../../types/dashboard';
import {
  CobitConceptBanner,
  ErrorBanner,
  SectionSkeleton,
} from '../LayoutPrimitives';

export function OkrsView() {
  const { data, loading, error, refetch } = useDashboardApi<OkrsData>('/api/okrs');

  if (loading && !data) return <SectionSkeleton />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <CobitConceptBanner
        kicker="COBIT 5 na Prática · Desdobramento Estratégico em OKRs (Objectives and Key Results)"
        title="Plano de Melhoria Orientado por Evidências do Compras.gov.br"
        concept="Os dois OKRs abaixo traduzem as maiores fragilidades diagnosticadas nos 7 habilitadores do COBIT 5 em objetivos qualitativos claros e resultados-chave mensuráveis, ancorados diretamente na linha de base (baseline) extraída do banco PostgreSQL de 2025."
        diagnosisLabel="Arquitetura do Plano de Ação"
        diagnosis="O OKR 1 ataca o eixo de Competição e Eficiência (Habilitadores 1 a 4), reduzindo a dependência de contratações diretas e o risco de fracionamento. O OKR 2 ataca o eixo de Integridade Informacional e Infraestrutura (Habilitadores 5 a 7), zerando distorções bilionárias e estabilizando a API de dados abertos."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
        {data.okrs.map((okr, idx) => {
          const isPrimaryTeal = idx === 0;
          const accentText = isPrimaryTeal ? 'text-[#0F6B72]' : 'text-[#C85A17]';
          const barBg = isPrimaryTeal ? 'bg-[#0F6B72]' : 'bg-[#C85A17]';

          return (
            <section
              key={okr.codigo}
              className="bg-white border border-[#E2E8F0] rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              {/* Cabeçalho do OKR */}
              <div className="space-y-3 pb-4 border-b border-[#E2E8F0]">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className={`font-semibold font-mono ${accentText}`}>
                    {okr.codigo} · {okr.dominiosCobit.join(' / ')}
                  </span>
                  <span className="text-[#64748B] font-medium">Prazo: {okr.prazoGeral}</span>
                </div>

                <h3 className="text-lg font-bold text-[#0F172A] leading-snug">{okr.titulo}</h3>

                <p className="text-[13.5px] text-[#334155] leading-relaxed">{okr.objetivo}</p>

                <div className="text-xs text-[#64748B]">
                  <span className="font-semibold text-[#334155]">Habilitadores vinculados:</span>{' '}
                  {okr.habilitadores.join(' · ')}
                </div>
              </div>

              {/* Lista de Key Results com Barra de Progresso Baseline vs Meta */}
              <div className="space-y-4 flex-1">
                {okr.keyResults.map((kr) => (
                  <div
                    key={kr.id}
                    className="pb-4 last:pb-0 border-b last:border-b-0 border-[#F1F5F9] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[13px] font-semibold text-[#0F172A] leading-snug">
                        <span className={`font-mono mr-1.5 ${accentText}`}>{kr.id}</span>
                        {kr.titulo}
                      </div>
                      <span className="font-mono text-[11px] text-[#64748B] whitespace-nowrap shrink-0">
                        {kr.prazo}
                      </span>
                    </div>

                    {/* Baseline vs Meta */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-[#64748B]">
                        Baseline (2025):{' '}
                        <strong className="font-mono tabular-nums text-[#0F172A]">
                          {kr.baselineLabel}
                        </strong>
                      </span>
                      <span className="text-[#64748B]">
                        Meta:{' '}
                        <strong className={`font-mono tabular-nums ${accentText}`}>
                          {kr.metaLabel}
                        </strong>
                      </span>
                    </div>

                    {/* Barra de progresso limpa */}
                    <div className="space-y-1">
                      <div className="h-2 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barBg} transition-all`}
                          style={{ width: `${Math.min(100, Math.max(6, kr.progressoAtualPct))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                        <span>{kr.evidencia}</span>
                        <span className="font-mono tabular-nums shrink-0 ml-2">
                          {kr.progressoAtualPct}% da meta
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Justificativa baseada nos dados */}
              <div className="pt-4 border-t border-[#E2E8F0] bg-[#F8FAFC] -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
                <div className="text-[11px] font-semibold text-[#475569]">
                  Evidência Empírica (PostgreSQL · Compras.gov.br 2025)
                </div>
                <p className="mt-1 text-xs text-[#334155] leading-relaxed">{okr.justificativa}</p>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
