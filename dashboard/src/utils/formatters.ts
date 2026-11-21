const MONTH_SHORT_PT: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fev',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez',
};

const MONTH_FULL_PT: Record<string, string> = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro',
};

export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'R$ 0,00';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) {
    return `${sign}R$ ${(abs / 1e12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tri`;
  }
  if (abs >= 1e9) {
    return `${sign}R$ ${(abs / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} bi`;
  }
  if (abs >= 1e6) {
    return `${sign}R$ ${(abs / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  }
  if (abs >= 1e3) {
    return `${sign}R$ ${(abs / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
  }
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCurrencyFull(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) return '0';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return '0,0%';
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

export function formatMonthShort(anoMes: string): string {
  if (!anoMes || !anoMes.includes('-')) return anoMes || '—';
  const [ano, mes] = anoMes.split('-');
  const m = MONTH_SHORT_PT[mes] ?? mes;
  return `${m}/${ano.slice(2)}`;
}

export function formatMonthFull(anoMes: string): string {
  if (!anoMes || !anoMes.includes('-')) return anoMes || '—';
  const [ano, mes] = anoMes.split('-');
  const m = MONTH_FULL_PT[mes] ?? mes;
  return `${m} de ${ano}`;
}

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  const ymMatch = /^(\d{4})-(\d{2})$/.exec(dateStr);
  if (ymMatch) {
    return `01/${ymMatch[2]}/${ymMatch[1]}`;
  }
  return dateStr;
}

export function truncateLabel(text: string, maxLen = 38): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trim()}…`;
}

const LOWERCASE_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'por', 'a', 'o', 'as', 'os', 'no', 'na', 'nos', 'nas', 'ao', 'aos',
]);

const UPPERCASE_ACRONYMS = new Set([
  'SERPRO', 'DATAPREV', 'TELEBRAS', 'TSE', 'STF', 'STJ', 'TCU', 'CGU', 'AGU', 'MGI',
  'IFTO', 'UFT', 'UFNT', 'UFF', 'UFG', 'UNIFAL', 'COFEN', 'COREN', 'CREA', 'CAU', 'CRC',
  'EMBRAPA', 'INSS', 'IBGE', 'DNIT', 'ANATEL', 'ANVISA', 'TI', 'TIC', 'CATMAT', 'CATSER',
  'PNCP', 'SRP', 'PCA', 'TO', 'MG', 'RS', 'SP', 'RJ', 'DF', 'PA', 'MA', 'MT', 'PR', 'BA', 'PI', 'RR',
  'S/A', 'S.A.', 'S.A', 'ME', 'EPP', 'II', 'III', 'IV', 'UF', 'UASG',
]);

const ACCENT_MAP: Record<string, string> = {
  servico: 'serviço',
  servicos: 'serviços',
  informacao: 'informação',
  informacoes: 'informações',
  informatica: 'informática',
  educacao: 'educação',
  ciencia: 'ciência',
  ciencias: 'ciências',
  exercito: 'exército',
  telecomunicacoes: 'telecomunicações',
  solucoes: 'soluções',
  comercializacao: 'comercialização',
  negocios: 'negócios',
  comercio: 'comércio',
  quimicos: 'químicos',
  farmaceuticos: 'farmacêuticos',
  previdencia: 'previdência',
  cristalia: 'cristália',
  lider: 'líder',
  saude: 'saúde',
  justica: 'justiça',
  seguranca: 'segurança',
  publica: 'pública',
  publicos: 'públicos',
  maranhao: 'maranhão',
  rondonia: 'rondônia',
  goias: 'goiás',
  aeronautica: 'aeronáutica',
  ministerio: 'ministério',
  relacoes: 'relações',
  gestao: 'gestão',
  inovacao: 'inovação',
  transferencia: 'transferência',
  computacao: 'computação',
  comunicacao: 'comunicação',
  manutencao: 'manutenção',
  instalacao: 'instalação',
  integracao: 'integração',
  implementacao: 'implementação',
  documentacao: 'documentação',
  mensuracao: 'mensuração',
  configuracao: 'configuração',
  customizacao: 'customização',
  analise: 'análise',
  agil: 'ágil',
  impressao: 'impressão',
  locacao: 'locação',
  paginas: 'páginas',
  moveis: 'móveis',
  pecas: 'peças',
  acessorios: 'acessórios',
  nao: 'não',
  topicos: 'tópicos',
  uniao: 'união',
  orgao: 'órgão',
  orgaos: 'órgãos',
  contratacao: 'contratação',
  licitacao: 'licitação',
};

/**
 * Converts ALL-CAPS open-data supplier/organ names into clean, highly legible
 * Brazilian Portuguese Title Case while preserving acronyms and accents.
 */
export function formatEntityName(raw: string): string {
  if (!raw) return 'Não informado';
  const cleaned = raw.replace(/\s+/g, ' ').trim();

  // Promote well-known public tech company acronyms to the front for instant scanning
  const upper = cleaned.toUpperCase();
  if (upper.includes('SERPRO')) return 'SERPRO · Serviço Federal de Processamento de Dados';
  if (upper.includes('DATAPREV')) return 'DATAPREV · Tecnologia e Informações da Previdência';
  if (upper.includes('TELEBRAS')) return 'TELEBRAS · Telecomunicações Brasileiras S.A.';

  const tokens = cleaned.split(' ');
  const formatted = tokens.map((token, idx) => {
    const stripped = token.replace(/^[([{"']+|[)\]},".,;:]+$/g, '');
    const prefix = token.slice(0, token.indexOf(stripped));
    const suffix = token.slice(token.indexOf(stripped) + stripped.length);
    const upperToken = stripped.toUpperCase();

    if (UPPERCASE_ACRONYMS.has(upperToken)) {
      return `${prefix}${upperToken}${suffix}`;
    }
    if (upperToken === 'LTDA' || upperToken === 'LTDA.') {
      return `${prefix}Ltda.${suffix}`;
    }

    const lowerToken = stripped.toLowerCase();
    const accented = ACCENT_MAP[lowerToken] ?? lowerToken;

    if (idx > 0 && LOWERCASE_WORDS.has(accented)) {
      return `${prefix}${accented}${suffix}`;
    }

    // Handle hyphenated words like SUL-RIO-GRANDENSE or UNIFAL-MG
    if (accented.includes('-')) {
      const parts = accented.split('-').map((part, pIdx) => {
        const pUp = part.toUpperCase();
        if (UPPERCASE_ACRONYMS.has(pUp)) return pUp;
        const pAcc = ACCENT_MAP[part] ?? part;
        if (pIdx > 0 && LOWERCASE_WORDS.has(pAcc)) return pAcc;
        return pAcc.charAt(0).toUpperCase() + pAcc.slice(1);
      });
      return `${prefix}${parts.join('-')}${suffix}`;
    }

    return `${prefix}${accented.charAt(0).toUpperCase() + accented.slice(1)}${suffix}`;
  });

  return formatted.join(' ');
}
