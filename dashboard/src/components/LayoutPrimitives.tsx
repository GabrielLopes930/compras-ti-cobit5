import React, { createContext, useContext, useEffect, useState } from 'react';
import { AlertCircle, BookOpen, RefreshCw, X } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'default' | 'teal' | 'alert' | 'positive';
}

export function KpiCard({ label, value, sublabel, tone = 'default' }: KpiCardProps) {
  const valueColor =
    tone === 'teal'
      ? 'text-[#0F6B72]'
      : tone === 'alert'
        ? 'text-[#C85A17]'
        : tone === 'positive'
          ? 'text-[#15803D]'
          : 'text-[#0F172A]';

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between min-h-[116px]">
      <div className="text-[13px] font-medium text-[#64748B] leading-snug">{label}</div>
      <div className={`mt-2 text-2xl xl:text-[28px] font-semibold font-mono tabular-nums tracking-tight ${valueColor}`}>
        {value}
      </div>
      {sublabel ? (
        <div className="mt-1.5 text-xs text-[#64748B] leading-relaxed">{sublabel}</div>
      ) : null}
    </div>
  );
}

export interface CobitConceptBannerProps {
  kicker: string;
  title: string;
  concept: string;
  diagnosisLabel?: string;
  diagnosis: string;
  emphasisTone?: 'teal' | 'alert';
}

interface ConceptModalContextValue {
  info: CobitConceptBannerProps | null;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  setInfo: (info: CobitConceptBannerProps | null) => void;
}

const ConceptModalContext = createContext<ConceptModalContextValue | null>(null);

export function ConceptModalProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<CobitConceptBannerProps | null>(null);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <ConceptModalContext.Provider value={{ info, isOpen, setOpen, setInfo }}>
      {children}

      {isOpen && info ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0F172A]/45 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="concept-modal-title"
        >
          <div
            className="w-full max-w-2xl bg-white border border-[#E2E8F0] rounded-xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#0F6B72]">{info.kicker}</div>
                <h2
                  id="concept-modal-title"
                  className="mt-1 text-lg font-bold text-[#0F172A] leading-snug"
                >
                  {info.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer shrink-0"
                aria-label="Fechar síntese e diagnóstico"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bloco 1: Fundamentação / Síntese Executiva */}
            <div className="px-6 py-5 space-y-1.5">
              <div className="text-xs font-semibold text-[#475569]">
                Síntese Conceitual e Enquadramento COBIT 5
              </div>
              <p className="text-[14px] text-[#334155] leading-relaxed">{info.concept}</p>
            </div>

            {/* Bloco 2: Diagnóstico Dinâmico Baseado nos Dados */}
            <div
              className={`px-6 py-5 border-t border-[#E2E8F0] space-y-1.5 ${
                info.emphasisTone === 'alert' ? 'bg-[#FDF8F5]' : 'bg-[#F8FAFC]'
              }`}
            >
              <div
                className={`text-xs font-semibold ${
                  info.emphasisTone === 'alert' ? 'text-[#C85A17]' : 'text-[#0F6B72]'
                }`}
              >
                {info.diagnosisLabel ?? 'Diagnóstico nos Dados (2025)'}
              </div>
              <p className="text-[14px] text-[#0F172A] leading-relaxed">{info.diagnosis}</p>
            </div>

            {/* Rodapé do Modal */}
            <div className="px-6 py-3.5 border-t border-[#E2E8F0] bg-white flex items-center justify-between gap-4">
              <span className="text-xs text-[#64748B]">
                Os números do diagnóstico acompanham automaticamente os filtros ativos.
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 px-4 text-xs font-medium text-white bg-[#0F6B72] hover:bg-[#0A5258] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConceptModalContext.Provider>
  );
}

export function ConceptModalTriggerButton() {
  const ctx = useContext(ConceptModalContext);

  useEffect(() => {
    if (!ctx) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        if (ctx?.info) ctx.setOpen(!ctx.isOpen);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ctx]);

  const disabled = !ctx?.info;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => ctx?.setOpen(true)}
      title="Abrir síntese executiva e diagnóstico dos dados (Alt + D)"
      className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-[#0F6B72]/30 bg-[#EBF5F6] text-[#0F6B72] hover:bg-[#DCEEEF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
    >
      <BookOpen className="w-3.5 h-3.5 shrink-0" />
      <span>Síntese e Diagnóstico</span>
    </button>
  );
}

export function CobitConceptBanner({
  kicker,
  title,
  concept,
  diagnosisLabel = 'Diagnóstico nos Dados (2025)',
  diagnosis,
  emphasisTone = 'teal',
}: CobitConceptBannerProps) {
  const ctx = useContext(ConceptModalContext);
  const setInfo = ctx?.setInfo;
  const setOpen = ctx?.setOpen;

  useEffect(() => {
    if (!setInfo) return;
    setInfo({ kicker, title, concept, diagnosisLabel, diagnosis, emphasisTone });
  }, [setInfo, kicker, title, concept, diagnosisLabel, diagnosis, emphasisTone]);

  useEffect(() => {
    return () => {
      setInfo?.(null);
      setOpen?.(false);
    };
  }, [setInfo, setOpen]);

  return null;
}

interface PanelProps {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Panel({ title, subtitle, headerRight, children, className = '' }: PanelProps) {
  return (
    <section className={`bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#0F172A] leading-snug">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[#64748B] leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <div className="pt-4 flex-1 flex flex-col">{children}</div>
    </section>
  );
}

export function SectionSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Carregando dados">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
            <div className="h-3 w-28 bg-slate-200 rounded" />
            <div className="h-7 w-36 bg-slate-200 rounded" />
            <div className="h-2.5 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 h-80 bg-white border border-[#E2E8F0] rounded-xl" />
        <div className="lg:col-span-5 h-80 bg-white border border-[#E2E8F0] rounded-xl" />
      </div>
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#C85A17] shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A]">Não foi possível carregar esta visão</h3>
          <p className="mt-1 text-xs text-[#64748B]">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0F6B72] hover:bg-[#0A5258] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Tentar novamente
      </button>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyNotice({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-6 text-center my-auto">
      <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
      <p className="mt-1 text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 px-4 py-2 text-xs font-medium text-[#0F6B72] bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
