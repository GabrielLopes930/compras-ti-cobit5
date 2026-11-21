import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  ShieldAlert,
  Target,
} from 'lucide-react';
import { GlobalFilterBar } from './components/GlobalFilterBar';
import {
  ConceptModalProvider,
  ConceptModalTriggerButton,
} from './components/LayoutPrimitives';
import { OverviewView } from './components/views/OverviewView';
import { Enabler1View } from './components/views/Enabler1View';
import { Enabler2View } from './components/views/Enabler2View';
import { Enabler3View } from './components/views/Enabler3View';
import { Enabler4View } from './components/views/Enabler4View';
import { Enabler5View } from './components/views/Enabler5View';
import { Enabler6View } from './components/views/Enabler6View';
import { Enabler7View } from './components/views/Enabler7View';
import { OkrsView } from './components/views/OkrsView';
import type { DashboardFilters, FilterOptionsResponse } from './types/dashboard';

type SectionId =
  | 'overview'
  | 'enabler1'
  | 'enabler2'
  | 'enabler3'
  | 'enabler4'
  | 'enabler5'
  | 'enabler6'
  | 'enabler7'
  | 'okrs';

interface NavItem {
  id: SectionId;
  index: string;
  shortLabel: string;
  fullTitle: string;
  supportsGlobalFilters: boolean;
  filterNote?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    index: '00',
    shortLabel: 'Visão Geral Executiva',
    fullTitle: 'Visão Geral Executiva',
    supportsGlobalFilters: true,
    icon: LayoutDashboard,
  },
  {
    id: 'enabler1',
    index: '01',
    shortLabel: 'Princípios e Políticas',
    fullTitle: 'Habilitador 1 · Princípios, Políticas e Modelos',
    supportsGlobalFilters: true,
    icon: Scale,
  },
  {
    id: 'enabler2',
    index: '02',
    shortLabel: 'Processos (APO/BAI/MEA)',
    fullTitle: 'Habilitador 2 · Processos (APO10, BAI03, MEA01)',
    supportsGlobalFilters: true,
    icon: GitBranch,
  },
  {
    id: 'enabler3',
    index: '03',
    shortLabel: 'Estruturas Org. (TO)',
    fullTitle: 'Habilitador 3 · Estruturas Organizacionais (Recorte Tocantins)',
    supportsGlobalFilters: true,
    icon: Building2,
  },
  {
    id: 'enabler4',
    index: '04',
    shortLabel: 'Cultura, Ética e Comp.',
    fullTitle: 'Habilitador 4 · Cultura, Ética e Comportamento',
    supportsGlobalFilters: true,
    icon: ShieldAlert,
  },
  {
    id: 'enabler5',
    index: '05',
    shortLabel: 'Informação e Qualidade',
    fullTitle: 'Habilitador 5 · Informação (Critérios COBIT 5)',
    supportsGlobalFilters: false,
    filterNote: 'Auditoria integral sobre as bases brutas e saneadas de 2025',
    icon: Database,
  },
  {
    id: 'enabler6',
    index: '06',
    shortLabel: 'Serviços e Infraestrutura',
    fullTitle: 'Habilitador 6 · Serviços, Infraestrutura e Aplicativos',
    supportsGlobalFilters: true,
    icon: Cpu,
  },
  {
    id: 'enabler7',
    index: '07',
    shortLabel: 'Pessoas e Competências',
    fullTitle: 'Habilitador 7 · Pessoas, Habilidades e Competências',
    supportsGlobalFilters: true,
    icon: GraduationCap,
  },
  {
    id: 'okrs',
    index: '08',
    shortLabel: 'Plano de Melhoria (OKRs)',
    fullTitle: 'Plano de Melhoria · OKRs (COBIT 5 na Prática)',
    supportsGlobalFilters: false,
    filterNote: 'OKRs ancorados na linha de base consolidada do exercício 2025',
    icon: Target,
  },
];

const EMPTY_FILTERS: DashboardFilters = {
  mes: '',
  modalidade: '',
  orgao: '',
  tipoItem: '',
};

export default function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResponse | null>(null);

  useEffect(() => {
    fetch('/api/filters')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: FilterOptionsResponse | null) => {
        if (json) setFilterOptions(json);
      })
      .catch(() => {
        // Handled cleanly inside individual section views
      });
  }, []);

  const currentIdx = NAV_ITEMS.findIndex((item) => item.id === activeSection);
  const currentItem = NAV_ITEMS[currentIdx] ?? NAV_ITEMS[0];

  const goToPrev = useCallback(() => {
    setActiveSection((prev) => {
      const idx = NAV_ITEMS.findIndex((i) => i.id === prev);
      return idx > 0 ? NAV_ITEMS[idx - 1].id : prev;
    });
  }, []);

  const goToNext = useCallback(() => {
    setActiveSection((prev) => {
      const idx = NAV_ITEMS.findIndex((i) => i.id === prev);
      return idx < NAV_ITEMS.length - 1 ? NAV_ITEMS[idx + 1].id : prev;
    });
  }, []);

  // Keyboard shortcuts Alt+Left / Alt+Right for smooth 16:9 classroom defense navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToNext, goToPrev]);

  const handleResetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  return (
    <ConceptModalProvider>
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex">
      {/* Navegação Lateral Recolhível (9 Visões) */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'
        } bg-white border-r border-[#E2E8F0] shrink-0 flex flex-col sticky top-0 h-screen transition-[width] duration-200 z-30`}
      >
        {/* Identidade do Projeto */}
        <div className="h-14 px-4 border-b border-[#E2E8F0] flex items-center justify-between gap-2">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#0F6B72] text-white flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-sm tracking-tight text-[#0F172A] truncate">
                Governança TI · COBIT 5
              </span>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-[#0F6B72] text-white flex items-center justify-center mx-auto">
              <BarChart3 className="w-4 h-4" />
            </div>
          )}
          {!sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-md transition-colors cursor-pointer shrink-0"
              title="Recolher menu lateral"
              aria-label="Recolher menu lateral"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Lista de 9 Abas */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1" aria-label="Navegação COBIT 5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeSection;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                title={item.fullTitle}
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#EBF5F6] text-[#0F6B72] font-semibold'
                    : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] font-medium'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#0F6B72]' : 'text-[#64748B]'
                  }`}
                />
                {!sidebarCollapsed ? (
                  <span className="flex items-center gap-2 min-w-0 flex-1 text-[13px] whitespace-nowrap truncate">
                    <span className="font-mono text-[11px] opacity-70">{item.index}</span>
                    <span className="truncate">{item.shortLabel}</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Rodapé discreto da sidebar */}
        <div className="p-3 border-t border-[#E2E8F0]">
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="w-full py-2 flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-md transition-colors cursor-pointer"
              title="Expandir menu lateral"
              aria-label="Expandir menu lateral"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          ) : (
            <div className="text-[11px] text-[#64748B] leading-relaxed px-1">
              <div className="font-medium text-[#334155]">Compras.gov.br · Dados Abertos</div>
              <div>Esfera Federal · 2025 · Lei 14.133/21</div>
            </div>
          )}
        </div>
      </aside>

      {/* Área Principal 16:9 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar limpa com Breadcrumb e Navegação de Apresentação */}
        <header className="h-14 bg-white border-b border-[#E2E8F0] px-5 lg:px-7 flex items-center justify-between gap-6 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-[#64748B] min-w-0">
            <span className="hidden sm:inline whitespace-nowrap">Contratações de TI (2025)</span>
            <span className="hidden sm:inline" aria-hidden="true">
              /
            </span>
            <h1 className="text-sm font-semibold text-[#0F172A] truncate">
              {currentItem.fullTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ConceptModalTriggerButton />
            <span className="h-4 w-px bg-[#E2E8F0] mx-1 hidden sm:inline-block" aria-hidden="true" />
            <span className="text-xs font-mono tabular-nums text-[#64748B] mr-1 whitespace-nowrap">
              {currentIdx + 1} / {NAV_ITEMS.length}
            </span>
            <button
              type="button"
              onClick={goToPrev}
              disabled={currentIdx === 0}
              className="h-8 px-2.5 inline-flex items-center gap-1 text-xs font-medium rounded-lg border border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
              title="Seção anterior (Alt + ←)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
            <button
              type="button"
              onClick={goToNext}
              disabled={currentIdx === NAV_ITEMS.length - 1}
              className="h-8 px-3 inline-flex items-center gap-1 text-xs font-medium rounded-lg bg-[#0F6B72] text-white hover:bg-[#0A5258] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
              title="Próxima seção (Alt + →)"
            >
              Próxima
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Barra de Filtros Globais Interativos */}
        <GlobalFilterBar
          filters={filters}
          options={filterOptions}
          onChange={setFilters}
          onReset={handleResetFilters}
          filtersDisabledNote={currentItem.supportsGlobalFilters ? null : currentItem.filterNote}
        />

        {/* Conteúdo da Visão Ativa */}
        <main className="flex-1 p-5 lg:p-7 max-w-[1600px] w-full mx-auto">
          {activeSection === 'overview' && (
            <OverviewView filters={filters} onClearFilters={handleResetFilters} />
          )}
          {activeSection === 'enabler1' && (
            <Enabler1View filters={filters} onClearFilters={handleResetFilters} />
          )}
          {activeSection === 'enabler2' && (
            <Enabler2View filters={filters} onClearFilters={handleResetFilters} />
          )}
          {activeSection === 'enabler3' && (
            <Enabler3View filters={filters} onClearFilters={handleResetFilters} />
          )}
          {activeSection === 'enabler4' && (
            <Enabler4View filters={filters} onClearFilters={handleResetFilters} />
          )}
          {activeSection === 'enabler5' && <Enabler5View />}
          {activeSection === 'enabler6' && (
            <Enabler6View filters={filters} onClearFilters={handleResetFilters} />
          )}
          {activeSection === 'enabler7' && (
            <Enabler7View filters={filters} onClearFilters={handleResetFilters} />
          )}
          {activeSection === 'okrs' && <OkrsView />}
        </main>
      </div>
    </div>
    </ConceptModalProvider>
  );
}
