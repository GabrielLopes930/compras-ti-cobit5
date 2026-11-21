import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, RotateCcw, Search, X } from 'lucide-react';
import type { DashboardFilters, FilterOptionsResponse } from '../types/dashboard';
import { formatNumber } from '../utils/formatters';

interface GlobalFilterBarProps {
  filters: DashboardFilters;
  options: FilterOptionsResponse | null;
  onChange: (next: DashboardFilters) => void;
  onReset: () => void;
  filtersDisabledNote?: string | null;
}

export function GlobalFilterBar({
  filters,
  options,
  onChange,
  onReset,
  filtersDisabledNote,
}: GlobalFilterBarProps) {
  const [organOpen, setOrganOpen] = useState(false);
  const [organSearch, setOrganSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = Boolean(
    filters.mes || filters.modalidade || filters.orgao || filters.tipoItem
  );

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOrganOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredOrgans = useMemo(() => {
    const list = options?.organs ?? [];
    const term = organSearch.trim().toLowerCase();
    if (!term) return list.slice(0, 60);
    return list.filter((o) => o.label.toLowerCase().includes(term)).slice(0, 60);
  }, [options?.organs, organSearch]);

  const itemTypes = ['', 'Serviço', 'Material'];

  return (
    <div className="bg-white border-b border-[#E2E8F0] px-5 lg:px-7 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Mês de inclusão */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-mes" className="text-xs font-medium text-[#64748B] whitespace-nowrap">
            Mês (2025)
          </label>
          <select
            id="filter-mes"
            value={filters.mes}
            onChange={(e) => onChange({ ...filters, mes: e.target.value })}
            className="h-9 px-3 pr-8 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F6B72] cursor-pointer"
          >
            <option value="">Todos os meses</option>
            {(options?.months ?? []).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Modalidade */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-mod" className="text-xs font-medium text-[#64748B] whitespace-nowrap">
            Modalidade
          </label>
          <select
            id="filter-mod"
            value={filters.modalidade}
            onChange={(e) => onChange({ ...filters, modalidade: e.target.value })}
            className="h-9 px-3 pr-8 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F6B72] cursor-pointer max-w-[200px]"
          >
            <option value="">Todas as modalidades</option>
            {(options?.modalities ?? []).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Órgão Contratante com busca */}
        <div className="relative flex items-center gap-2" ref={dropdownRef}>
          <span className="text-xs font-medium text-[#64748B] whitespace-nowrap">Órgão</span>
          <button
            type="button"
            onClick={() => setOrganOpen((prev) => !prev)}
            className="h-9 px-3 text-xs font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#CBD5E1] hover:border-[#94A3B8] rounded-lg flex items-center justify-between gap-2 w-[230px] lg:w-[270px] cursor-pointer"
            title={filters.orgao || 'Todos os órgãos federais'}
          >
            <span className="truncate text-left">
              {filters.orgao || 'Todos os órgãos federais'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
          </button>

          {organOpen ? (
            <div className="absolute left-0 top-11 z-40 w-[340px] bg-white border border-[#CBD5E1] rounded-xl shadow-lg overflow-hidden">
              <div className="p-2.5 border-b border-[#E2E8F0] flex items-center gap-2 bg-[#F8FAFC]">
                <Search className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                <input
                  type="text"
                  value={organSearch}
                  onChange={(e) => setOrganSearch(e.target.value)}
                  placeholder="Buscar órgão contratante..."
                  autoFocus
                  className="w-full text-xs bg-transparent text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
                />
                {organSearch ? (
                  <button
                    type="button"
                    onClick={() => setOrganSearch('')}
                    className="text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                    aria-label="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...filters, orgao: '' });
                    setOrganOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    !filters.orgao
                      ? 'bg-[#EBF5F6] text-[#0F6B72] font-semibold'
                      : 'text-[#334155] hover:bg-[#F8FAFC]'
                  }`}
                >
                  Todos os órgãos federais
                </button>
                {filteredOrgans.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-[#64748B] text-center">
                    Nenhum órgão encontrado para &ldquo;{organSearch}&rdquo;.
                  </div>
                ) : (
                  filteredOrgans.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        onChange({ ...filters, orgao: o.value });
                        setOrganOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        filters.orgao === o.value
                          ? 'bg-[#EBF5F6] text-[#0F6B72] font-semibold'
                          : 'text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <span className="truncate">{o.label}</span>
                      {o.count != null ? (
                        <span className="font-mono tabular-nums text-[11px] text-[#64748B] shrink-0">
                          {formatNumber(o.count)}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Tipo de Item (Segmented Control) */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#64748B] whitespace-nowrap">Tipo</span>
          <div className="inline-flex items-center p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg">
            {itemTypes.map((type) => {
              const active = filters.tipoItem === type;
              return (
                <button
                  key={type || 'all'}
                  type="button"
                  onClick={() => onChange({ ...filters, tipoItem: type })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-[#0F6B72] shadow-xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {type || 'Todos'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Limpar Filtros */}
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveFilters}
          className={`h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
            hasActiveFilters
              ? 'border-[#C85A17]/40 text-[#C85A17] bg-[#FDF1E9] hover:bg-[#FCE4D4] cursor-pointer'
              : 'border-[#E2E8F0] text-[#94A3B8] bg-[#F8FAFC] cursor-not-allowed'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Limpar Filtros
        </button>

        {/* Quiet context info on the far right */}
        {filtersDisabledNote ? (
          <span className="ml-auto text-[11px] text-[#64748B] hidden xl:inline">
            {filtersDisabledNote}
          </span>
        ) : options?.dataSource === 'verified_snapshot' ? (
          <span className="ml-auto text-[11px] text-[#64748B] hidden xl:inline">
            Base verificada 2025 · Configure DATABASE_URL no .env para filtros SQL ao vivo
          </span>
        ) : (
          <span className="ml-auto text-[11px] text-[#64748B] hidden xl:inline">
            PostgreSQL (Somente Leitura) · Lei nº 14.133/2021 · Esfera Federal 2025
          </span>
        )}
      </div>
    </div>
  );
}
