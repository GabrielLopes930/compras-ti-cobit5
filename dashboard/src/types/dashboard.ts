export interface DashboardFilters {
  mes: string;
  modalidade: string;
  orgao: string;
  tipoItem: string;
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterOptionsResponse {
  months: FilterOption[];
  modalities: FilterOption[];
  organs: FilterOption[];
  itemTypes: FilterOption[];
  dataSource: 'live_postgres' | 'verified_snapshot';
  snapshotGeneratedAt?: string;
}

export interface OverviewData {
  kpis: {
    totalItens: number;
    totalContratacoes: number;
    valorEstimado: number;
    valorHomologado: number;
    economiaMediaGlobal: number;
    economiaPonderadaGlobal: number;
    paresValidosEconomia: number;
  };
  monthlyEvolution: Array<{
    mes: string;
    label: string;
    valorEstimado: number;
    valorHomologado: number;
    totalItens: number;
    totalContratacoes: number;
    isPeak: boolean;
  }>;
  mixTipoItem: Array<{
    tipo: string;
    itens: number;
    valorEstimado: number;
    valorHomologado: number;
    pctValor: number;
    pctItens: number;
  }>;
}

export interface Enabler1Data {
  comparison: Array<{
    grupo: 'Com Competição' | 'Contratação Direta';
    valorEstimado: number;
    valorHomologado: number;
    qtdContratacoes: number;
    qtdItens: number;
    pctValor: number;
    pctContratacoes: number;
  }>;
  byModality: Array<{
    modalidade: string;
    tipoContratacao: string;
    valorEstimado: number;
    valorHomologado: number;
    qtdContratacoes: number;
    qtdItens: number;
    pctValor: number;
    pctContratacoes: number;
  }>;
  summary: {
    pctDiretaValor: number;
    pctDiretaContratacoes: number;
    pctCompetitivaValor: number;
    pctCompetitivaContratacoes: number;
  };
}

export interface Enabler2Data {
  savingsByModality: Array<{
    modalidade: string;
    tipoContratacao: string;
    paresValidos: number;
    economiaMedia: number;
    economiaPonderada: number;
    valorEstimadoPares: number;
    valorHomologadoPares: number;
  }>;
  itemOutcomes: Array<{
    situacao: string;
    quantidade: number;
    percentual: number;
    isRetrabalho: boolean;
  }>;
  summary: {
    taxaSucessoHomologacao: number;
    taxaRetrabalho: number;
    totalRetrabalho: number;
    totalItens: number;
    economiaPregao: number;
    economiaDispensa: number;
    economiaInexigibilidade: number;
  };
}

export interface Enabler3Data {
  kpis: {
    totalContratacoesTO: number;
    totalItensTO: number;
    pctDiretasTO: number;
    qtdDiretasTO: number;
    economiaMediaTO: number;
    economiaPonderadaTO: number;
    valorEstimadoTO: number;
    valorHomologadoTO: number;
    ticketMedioTO: number;
    ticketMedioNacional: number;
  };
  topOrgaosTO: Array<{
    orgao: string;
    compras: number;
    comprasDiretas: number;
    comprasCompetitivas: number;
    pctDiretas: number;
    valorEstimado: number;
    valorHomologado: number;
  }>;
  pcaStatus: {
    totalRegistros: number;
    disponivel: boolean;
    valorPlanejadoTotal: number;
    orgaosComPca: number;
  };
}

export interface Enabler4Data {
  supplierConcentration: {
    totalFornecedoresDistintos: number;
    valorHomologadoTotal: number;
    top10Valor: number;
    top10Pct: number;
    top3Pct: number;
    empresasPublicasValor: number;
    empresasPublicasPct: number;
  };
  top10Suppliers: Array<{
    nomeFornecedor: string;
    itens: number;
    valorHomologado: number;
    pctTotal: number;
    isPublicTech: boolean;
    isClassificationAnomaly: boolean;
  }>;
  dispensaHistogram: Array<{
    faixa: string;
    quantidade: number;
    pct: number;
    valorEstimado: number;
    isAlertBucket: boolean;
  }>;
  dispensaSummary: {
    totalDispensasComTeto: number;
    qtdFaixa80a90: number;
    qtdFaixa90a100: number;
    qtdAcimaTeto: number;
    razaoSalto90vs80: number;
  };
}

export interface OutlierAuditRow {
  tipoRegistro: 'Item (> R$ 1 bi)' | 'Contratação (> R$ 10 bi)';
  idRegistro: string;
  orgao: string;
  esfera: string;
  uf: string;
  modalidade: string;
  mes: string;
  descricao: string;
  valorEstimado: number;
  valorHomologado: number | null;
}

export interface NonTiExampleRow {
  idItem: string;
  orgao: string;
  codigoGrupo: number | null;
  codigoClasse: number | null;
  descricao: string;
  valorEstimado: number;
}

export interface Enabler5Data {
  qualityMatrix: {
    integridade: {
      outliersItensQtdTotal: number;
      outliersItensQtdFederal: number;
      outliersItensSomaTotal: number;
      outliersItensSomaFederal: number;
      outliersContratacoesFederalQtd: number;
      semValorEstimadoQtd: number;
      semValorEstimadoPct: number;
      totalContratacoesBase: number;
    };
    confiabilidade: {
      alteradasPosPubQtd: number;
      alteradasPosPubPct: number;
      itensAlteradosQtd: number;
      itensAlteradosPct: number;
    };
    conformidade: {
      totalRawItens: number;
      naoFederaisQtd: number;
      naoFederaisPct: number;
      naoValidadosTiQtd: number;
      naoValidadosTiPct: number;
    };
    disponibilidade: {
      taxaMediaSucessoApi: number;
      menorTaxaSucessoApi: number;
      mesesMonitorados: number;
      totalRequisicoesApi: number;
    };
    efetividadeEficiencia: {
      itensOrfaosQtd: number;
      itensOrfaosPct: number;
    };
  };
  outlierAuditRows: OutlierAuditRow[];
  nonTiExamples: NonTiExampleRow[];
}

export interface Enabler6Data {
  apiPerformance: Array<{
    anoMes: string;
    label: string;
    totalServicos: number;
    totalRequisicoes: number;
    percentualSucesso: number;
    mediaTempoRespostaMs: number;
    totalDownloadGb: number;
  }>;
  apiSummary: {
    latenciaInicialMs: number;
    latenciaFinalMs: number;
    fatorDegradacao: number;
    picoRequisicoes: number;
    picoRequisicoesMes: string;
    totalDownloadGbAno: number;
  };
  mixTi: Array<{
    tipo: string;
    itens: number;
    valorEstimado: number;
    valorHomologado: number;
    pctValor: number;
    pctItens: number;
  }>;
  topCatalogo: Array<{
    tipo: string;
    codigo: string;
    nome: string;
    itens: number;
    valorEstimado: number;
    pctValor: number;
  }>;
}

export interface Enabler7Data {
  byItemType: Array<{
    tipo: string;
    totalItens: number;
    falhasQtd: number;
    taxaFalha: number;
    errosCadastroQtd: number;
    taxaErroCadastro: number;
  }>;
  byOrgan: Array<{
    orgao: string;
    totalItens: number;
    falhasQtd: number;
    taxaFalha: number;
    errosCadastroQtd: number;
    taxaErroCadastro: number;
    valorEstimado: number;
  }>;
  summary: {
    taxaFalhaGlobal: number;
    taxaErroCadastroGlobal: number;
    totalFalhas: number;
    totalErrosCadastro: number;
    totalItensAvaliados: number;
  };
}

export interface OkrKeyResult {
  id: string;
  titulo: string;
  baselineLabel: string;
  metaLabel: string;
  baselineNum: number;
  metaNum: number;
  progressoAtualPct: number;
  unidade: string;
  prazo: string;
  evidencia: string;
}

export interface OkrCardData {
  codigo: string;
  titulo: string;
  objetivo: string;
  habilitadores: string[];
  dominiosCobit: string[];
  prazoGeral: string;
  justificativa: string;
  keyResults: OkrKeyResult[];
}

export interface OkrsData {
  okrs: OkrCardData[];
  baselines: {
    pctDiretasFederal: number;
    pctDiretasTO: number;
    economiaPregao: number;
    economiaDispensa: number;
    outliersFederalQtd: number;
    naoFederaisPct: number;
    orfaosPct: number;
    latenciaFinalMs: number;
    taxaFalhaItens: number;
  };
}
