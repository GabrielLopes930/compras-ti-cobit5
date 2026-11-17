import calendar
import json
import os
import re
import sqlite3
import time
from datetime import datetime
from pathlib import Path
import requests

# ============================================================================
# CONFIGURACOES GERAIS DO PROJETO (RECORTES 2024 - 2026)
# ============================================================================
BASE_URL = "https://dadosabertos.compras.gov.br"
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "compras_ti_cobit.db"
PUBLIC_DATA_DIR = BASE_DIR / "public_data"
PUBLIC_DATA_DIR.mkdir(exist_ok=True)

# Se quiser espelhar no Neon Postgres, defina a variavel de ambiente DATABASE_URL
NEON_DATABASE_URL = os.getenv("DATABASE_URL", "")

ANOS_ESCOPO = [2024, 2025, 2026]

# Tetos legais de Dispensa de Licitacao (Art. 75, II da Lei 14.133/2021)
TETO_DISPENSA_ART75_II = {
    2024: 59906.02,  # Decreto 11.871/2023
    2025: 62725.59,  # Decreto 12.343/2024
    2026: 65492.11,  # Decreto 12.807/2025
}

# Modalidades PNCP (Lei 14.133)
MODALIDADES_PNCP = {
    6: ("Pregão - Eletrônico", "Com Competição"),
    7: ("Pregão - Presencial", "Com Competição"),
    4: ("Concorrência - Eletrônica", "Com Competição"),
    5: ("Concorrência - Presencial", "Com Competição"),
    2: ("Diálogo Competitivo", "Com Competição"),
    8: ("Dispensa de Licitação", "Contratação Direta"),
    9: ("Inexigibilidade", "Contratação Direta"),
}

# Orgaos alvo do Tocantins para analise de PCA (Tarefa T2 / Pagina 5)
ORGAOS_PCA_TO = {
    "26251": "UFT",   # Fundacao Universidade Federal do Tocantins
    "26424": "IFTO",  # Instituto Federal do Tocantins
}

# Palavras-chave para validacao tematica de TI (Tarefa T1 / T3)
REGEX_PALAVRAS_TI = re.compile(
    r"\b(software|licen[cç]a|computador|notebook|laptop|servidor|storage|"
    r"switch|roteador|firewall|nuvem|cloud|saas|iaas|paas| Fibra [oó]ptica|"
    r"inform[aá]tica|processamento de dados|banco de dados|sistema web|"
    r"desenvolvimento de sistema|suporte t[eé]cnico|help\s?desk|service\s?desk|"
    r"ciberseguran[cç]a|antiv[ií]rus|backup|datacenter|data center|rede l[oó]gica|"
    r"monitor led|impressora|scanner|nobreak|ups|token|certificado digital)\b",
    re.IGNORECASE,
)

session = requests.Session()
session.headers.update({
    "Accept": "application/json",
    "User-Agent": "COBIT5-Research-ULBRA-Palmas/1.0"
})


# ============================================================================
# CAMADA DE BANCO DE DADOS E CHECKPOINT
# ============================================================================
def conectar_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def inicializar_schema(conn: sqlite3.Connection):
    cur = conn.cursor()

    cur.executescript("""
    CREATE TABLE IF NOT EXISTS etl_checkpoints (
        chave_tarefa TEXT PRIMARY KEY,
        concluido INTEGER DEFAULT 0,
        total_registros INTEGER DEFAULT 0,
        updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS dim_catalogo_ti (
        tipo_item TEXT NOT NULL,
        codigo_grupo INTEGER,
        nome_grupo TEXT,
        codigo_classe INTEGER NOT NULL,
        nome_classe TEXT,
        PRIMARY KEY (tipo_item, codigo_classe)
    );

    CREATE TABLE IF NOT EXISTS fato_contratacoes (
        id_compra TEXT PRIMARY KEY,
        numero_controle_pncp TEXT,
        ano_compra INTEGER,
        mes_publicacao TEXT,
        codigo_orgao INTEGER,
        orgao_cnpj TEXT,
        orgao_razao_social TEXT,
        orgao_esfera TEXT,
        orgao_poder TEXT,
        codigo_uasg TEXT,
        nome_uasg TEXT,
        uf TEXT,
        municipio TEXT,
        codigo_ibge INTEGER,
        codigo_modalidade INTEGER,
        modalidade_nome TEXT,
        tipo_contratacao TEXT,
        modo_disputa_nome TEXT,
        amparo_legal_codigo INTEGER,
        amparo_legal_nome TEXT,
        amparo_legal_descricao TEXT,
        srp INTEGER,
        orcamento_sigiloso_descricao TEXT,
        flag_orcamento_sigiloso INTEGER,
        situacao_compra_nome TEXT,
        objeto_compra TEXT,
        valor_total_estimado REAL,
        valor_total_homologado REAL,
        economia_reais REAL,
        economia_percentual REAL,
        teto_dispensa_ano REAL,
        pct_limite_dispensa REAL,
        data_publicacao_pncp TEXT,
        data_abertura_proposta TEXT,
        data_encerramento_proposta TEXT,
        prazo_dias INTEGER,
        data_inclusao_pncp TEXT,
        data_atualizacao_pncp TEXT,
        flag_alterado_apos_publicacao INTEGER,
        flag_valor_nulo_ou_zerado INTEGER,
        contratacao_excluida INTEGER,
        escopo_origem TEXT
    );

    CREATE TABLE IF NOT EXISTS fato_itens_ti (
        id_compra_item TEXT PRIMARY KEY,
        id_compra TEXT,
        numero_controle_pncp_compra TEXT,
        ano_inclusao INTEGER,
        mes_inclusao TEXT,
        codigo_uasg TEXT,
        orgao_cnpj TEXT,
        numero_item_compra INTEGER,
        material_ou_servico TEXT,
        material_ou_servico_nome TEXT,
        codigo_grupo INTEGER,
        codigo_classe INTEGER,
        cod_item_catalogo INTEGER,
        codigo_pdm INTEGER,
        nome_pdm TEXT,
        descricao_resumida TEXT,
        descricao_detalhada TEXT,
        validado_palavra_chave_ti INTEGER,
        unidade_medida TEXT,
        orcamento_sigiloso INTEGER,
        item_categoria_nome TEXT,
        criterio_julgamento_nome TEXT,
        situacao_compra_item_nome TEXT,
        flag_fracasso_deserto_cancelado INTEGER,
        tipo_beneficio_nome TEXT,
        quantidade REAL,
        valor_unitario_estimado REAL,
        valor_total REAL,
        tem_resultado INTEGER,
        cod_fornecedor TEXT,
        nome_fornecedor TEXT,
        quantidade_resultado REAL,
        valor_unitario_resultado REAL,
        valor_total_resultado REAL,
        data_inclusao_pncp TEXT,
        data_atualizacao_pncp TEXT,
        flag_item_alterado INTEGER,
        flag_erro_cadastro INTEGER
    );

    CREATE TABLE IF NOT EXISTS fato_resultados_ti (
        id_compra_item TEXT,
        sequencial_resultado INTEGER,
        id_compra TEXT,
        codigo_uasg TEXT,
        uf_uasg TEXT,
        orgao_cnpj TEXT,
        ni_fornecedor TEXT,
        tipo_pessoa TEXT,
        nome_razao_social_fornecedor TEXT,
        porte_fornecedor_id INTEGER,
        porte_fornecedor_nome TEXT,
        flag_me_epp INTEGER,
        natureza_juridica_id TEXT,
        natureza_juridica_nome TEXT,
        quantidade_homologada REAL,
        valor_unitario_homologado REAL,
        valor_total_homologado REAL,
        percentual_desconto REAL,
        situacao_resultado_nome TEXT,
        motivo_cancelamento TEXT,
        flag_cancelado_sem_motivo INTEGER,
        aplicacao_beneficio_meepp INTEGER,
        aplicacao_margem_preferencia INTEGER,
        data_resultado_pncp TEXT,
        data_inclusao_pncp TEXT,
        data_atualizacao_pncp TEXT,
        PRIMARY KEY (id_compra_item, sequencial_resultado)
    );

    CREATE TABLE IF NOT EXISTS fato_pca_to (
        id_pca_key TEXT PRIMARY KEY,
        ano_pca INTEGER,
        orgao TEXT,
        sigla_instituicao TEXT,
        codigo_uasg TEXT,
        nome_uasg TEXT,
        numero_artefato INTEGER,
        ordem_dfd INTEGER,
        descricao_objeto_dfd TEXT,
        nivel_prioridade_dfd INTEGER,
        data_prevista_formalizacao TEXT,
        tipo_item TEXT,
        item_sustentavel INTEGER,
        codigo_grupo_material INTEGER,
        nome_grupo_material TEXT,
        codigo_classe_material INTEGER,
        nome_classe_material TEXT,
        codigo_grupo_servico INTEGER,
        nome_grupo_servico TEXT,
        codigo_item_catalogo TEXT,
        descricao_item_catalogo TEXT,
        quantidade_item REAL,
        valor_unitario_item REAL,
        valor_total_item REAL,
        flag_item_ti INTEGER,
        data_hora_publicacao_pncp TEXT
    );

    CREATE TABLE IF NOT EXISTS fato_indicadores_api (
        ano_mes TEXT PRIMARY KEY,
        ano INTEGER,
        mes INTEGER,
        total_servicos INTEGER,
        total_requisicoes INTEGER,
        percentual_sucesso REAL,
        media_tempo_resposta_ms REAL,
        total_download_gb REAL
    );
    """)
    conn.commit()


def tarefa_concluida(conn: sqlite3.Connection, chave: str) -> bool:
    cur = conn.execute(
        "SELECT concluido FROM etl_checkpoints WHERE chave_tarefa = ?",
        (chave,)
    )
    row = cur.fetchone()
    return bool(row and row[0] == 1)


def marcar_checkpoint(conn: sqlite3.Connection, chave: str, qtd: int):
    agora = datetime.now().isoformat(timespec="seconds")
    conn.execute("""
        INSERT INTO etl_checkpoints (chave_tarefa, concluido, total_registros, updated_at)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(chave_tarefa) DO UPDATE SET
            concluido = 1,
            total_registros = excluded.total_registros,
            updated_at = excluded.updated_at
    """, (chave, qtd, agora))
    conn.commit()


# ============================================================================
# CLIENTE HTTP COM RETRY E PAGINACAO AUTOMATICA
# ============================================================================
def requisitar_json(path: str, params: dict, tentativas: int = 3) -> dict:
    url = f"{BASE_URL}{path}"
    for t in range(1, tentativas + 1):
        try:
            resp = session.get(url, params=params, timeout=35)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code in (429, 500, 502, 503, 504):
                espera = t * 2.5
                print(f"    [!] HTTP {resp.status_code} em {path}. Aguardando {espera}s...", flush=True)
                time.sleep(espera)
            else:
                return {}
        except Exception as e:
            if t == tentativas:
                print(f"    [X] Falha de rede após {tentativas} tentativas: {e}", flush=True)
            time.sleep(t * 2)
    return {}


def coletar_todas_paginas(path: str, params_base: dict, max_paginas: int = 200) -> list:
    registros = []
    pagina = 1
    while pagina <= max_paginas:
        params = params_base.copy()
        params["pagina"] = pagina
        if "tamanhoPagina" not in params:
            params["tamanhoPagina"] = 500

        dados = requisitar_json(path, params)
        if not dados or "resultado" not in dados:
            break

        lote = dados.get("resultado") or []
        if not lote:
            break

        registros.extend(lote)
        restantes = dados.get("paginasRestantes", 0)
        if restantes == 0:
            break

        pagina += 1
        time.sleep(0.25)

    return registros


# ============================================================================
# TAREFA T1: DEFINIR CODIGOS DE TI (CATMAT GRUPO 70 E CATSER TIC)
# ============================================================================
def executar_t1_catalogo_ti(conn: sqlite3.Connection) -> tuple[list[int], list[int]]:
    print("\n>>> [T1] Mapeando códigos de TI no CATMAT (Grupo 70) e CATSER...", flush=True)

    # 1. Classes do Grupo 70 do CATMAT
    dados_mat = requisitar_json(
        "/modulo-material/2_consultarClasseMaterial",
        {"codigoGrupo": 70, "statusClasse": True, "pagina": 1}
    )
    classes_mat = dados_mat.get("resultado") or []

    for c in classes_mat:
        conn.execute("""
            INSERT OR REPLACE INTO dim_catalogo_ti
            (tipo_item, codigo_grupo, nome_grupo, codigo_classe, nome_classe)
            VALUES ('M', ?, ?, ?, ?)
        """, (
            c.get("codigoGrupo", 70),
            c.get("nomeGrupo", "EQUIPAMENTO E SUPRIMENTO DE INFORMÁTICA"),
            c.get("codigoClasse"),
            c.get("nomeClasse")
        ))

    # 2. Grupos de Serviço de TIC (Seção 1 - Serviços de TIC)
    dados_div = requisitar_json(
        "/modulo-servico/2_consultarDivisaoServico",
        {"codigoSecao": 1, "statusDivisao": True, "pagina": 1}
    )
    divisoes = [d.get("codigoDivisao") for d in (dados_div.get("resultado") or [])]
    # Inclui divisão 11 (Desenvolvimento e Manutenção de Software vista na amostra)
    if 11 not in divisoes:
        divisoes.append(11)

    for div in divisoes:
        dados_grp = requisitar_json(
            "/modulo-servico/3_consultarGrupoServico",
            {"codigoDivisao": div, "statusGrupo": True, "pagina": 1}
        )
        for g in (dados_grp.get("resultado") or []):
            cod_g = g.get("codigoGrupo")
            conn.execute("""
                INSERT OR REPLACE INTO dim_catalogo_ti
                (tipo_item, codigo_grupo, nome_grupo, codigo_classe, nome_classe)
                VALUES ('S', ?, ?, ?, ?)
            """, (
                cod_g,
                g.get("nomeGrupo"),
                cod_g,  # Usa o código do grupo como chave de filtro para serviços
                g.get("nomeDivisao")
            ))

    conn.commit()

    cur_m = conn.execute("SELECT codigo_classe FROM dim_catalogo_ti WHERE tipo_item = 'M'")
    lista_classes_mat = [r[0] for r in cur_m.fetchall()]

    cur_s = conn.execute("SELECT codigo_grupo FROM dim_catalogo_ti WHERE tipo_item = 'S'")
    lista_grupos_serv = [r[0] for r in cur_s.fetchall()]

    print(f"    [+] T1 Concluída: {len(lista_classes_mat)} classes CATMAT e {len(lista_grupos_serv)} grupos CATSER mapeados.", flush=True)
    return lista_classes_mat, lista_grupos_serv


# ============================================================================
# FUNCOES AUXILIARES DE TRATAMENTO (TAREFA T3)
# ============================================================================
def calcular_dias(dt_ini: str, dt_fim: str) -> int | None:
    if not dt_ini or not dt_fim:
        return None
    try:
        d1 = datetime.fromisoformat(dt_ini[:19])
        d2 = datetime.fromisoformat(dt_fim[:19])
        return max(0, (d2 - d1).days)
    except Exception:
        return None


def salvar_contratacoes_lote(conn: sqlite3.Connection, lote: list, escopo: str):
    for c in lote:
        id_compra = str(c.get("idCompra") or "").strip()
        if not id_compra:
            continue

        dt_pub = c.get("dataPublicacaoPncp") or ""
        dt_inc = c.get("dataInclusaoPncp") or ""
        dt_atu = c.get("dataAtualizacaoPncp") or ""
        dt_enc = c.get("dataEncerramentoPropostaPncp") or ""

        # Verifica se ja existe versao mais recente no banco (deduplicacao T3)
        cur = conn.execute(
            "SELECT data_atualizacao_pncp FROM fato_contratacoes WHERE id_compra = ?",
            (id_compra,)
        )
        existente = cur.fetchone()
        if existente and existente[0] and dt_atu and dt_atu < existente[0]:
            continue

        ano_pub = int(dt_pub[:4]) if len(dt_pub) >= 4 and dt_pub[:4].isdigit() else (c.get("anoCompraPncp") or 2025)
        mes_pub = dt_pub[:7] if len(dt_pub) >= 7 else f"{ano_pub}-01"

        cod_mod = c.get("codigoModalidade")
        mod_nome_api = c.get("modalidadeNome") or MODALIDADES_PNCP.get(cod_mod, ("Outros", "Outros"))[0]
        tipo_contr = (
            "Contratação Direta"
            if cod_mod in (8, 9) or "Dispensa" in mod_nome_api or "Inexigibilidade" in mod_nome_api
            else "Com Competição"
        )

        val_est = c.get("valorTotalEstimado")
        val_hom = c.get("valorTotalHomologado")

        flag_nulo_zero = 1 if (val_est is None or val_est <= 0) else 0
        econ_reais = None
        econ_pct = None
        if val_est and val_est > 0 and val_hom is not None and val_hom > 0:
            econ_reais = round(val_est - val_hom, 4)
            econ_pct = round(((val_est - val_hom) / val_est) * 100, 4)

        teto_ano = TETO_DISPENSA_ART75_II.get(ano_pub, 62725.59)
        pct_teto = round((val_est / teto_ano) * 100, 2) if (val_est and teto_ano) else None

        orc_desc = c.get("orcamentoSigilosoDescricao") or ""
        flag_sigilo = 0 if "sem sigilo" in orc_desc.lower() else (1 if orc_desc else 0)
        flag_alterado = 1 if (dt_atu and dt_inc and dt_atu[:19] > dt_inc[:19]) else 0
        uasg = str(c.get("unidadeOrgaoCodigoUnidade") or "").strip().zfill(6)

        conn.execute("""
            INSERT OR REPLACE INTO fato_contratacoes VALUES (
                ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
            )
        """, (
            id_compra,
            c.get("numeroControlePNCP"),
            ano_pub,
            mes_pub,
            c.get("codigoOrgao"),
            c.get("orgaoEntidadeCnpj"),
            c.get("orgaoEntidadeRazaoSocial"),
            c.get("orgaoEntidadeEsferaId"),
            c.get("orgaoEntidadePoderId"),
            uasg,
            c.get("unidadeOrgaoNomeUnidade"),
            c.get("unidadeOrgaoUfSigla"),
            c.get("unidadeOrgaoMunicipioNome"),
            c.get("unidadeOrgaoCodigoIbge"),
            cod_mod,
            mod_nome_api,
            tipo_contr,
            c.get("modoDisputaNomePncp"),
            c.get("amparoLegalCodigoPncp"),
            c.get("amparoLegalNome"),
            c.get("amparoLegalDescricao"),
            1 if c.get("srp") else 0,
            orc_desc,
            flag_sigilo,
            c.get("situacaoCompraNomePncp"),
            c.get("objetoCompra"),
            val_est,
            val_hom,
            econ_reais,
            econ_pct,
            teto_ano,
            pct_teto,
            dt_pub,
            c.get("dataAberturaPropostaPncp"),
            dt_enc,
            calcular_dias(dt_pub, dt_enc),
            dt_inc,
            dt_atu,
            flag_alterado,
            flag_nulo_zero,
            1 if c.get("contratacaoExcluida") else 0,
            escopo
        ))


def salvar_itens_lote(conn: sqlite3.Connection, lote: list):
    for it in lote:
        id_item = str(it.get("idCompraItem") or "").strip()
        if not id_item:
            continue

        dt_inc = it.get("dataInclusaoPncp") or ""
        dt_atu = it.get("dataAtualizacaoPncp") or ""

        desc_res = it.get("descricaoResumida") or ""
        desc_det = it.get("descricaodetalhada") or it.get("descricaoDetalhada") or ""
        nome_pdm = it.get("nomePdm") or ""
        texto_busca = f"{desc_res} {desc_det} {nome_pdm}"

        validado_kw = 1 if REGEX_PALAVRAS_TI.search(texto_busca) else 0
        sit_nome = it.get("situacaoCompraItemNome") or ""
        flag_fracasso = 1 if any(p in sit_nome.lower() for p in ("deserto", "fracassado", "cancelado", "anulado")) else 0
        flag_alt = 1 if (dt_atu and dt_inc and dt_atu[:19] > dt_inc[:19]) else 0

        val_tot = it.get("valorTotal")
        qtd = it.get("quantidade")
        flag_erro = 1 if (val_tot is None or val_tot <= 0 or qtd is None or qtd <= 0 or not desc_res.strip()) else 0

        cod_pdm_raw = it.get("codigoPdm")
        cod_pdm = int(cod_pdm_raw) if (cod_pdm_raw and str(cod_pdm_raw).isdigit()) else None
        uasg = str(it.get("unidadeOrgaoCodigoUnidade") or "").strip().zfill(6)

        conn.execute("""
            INSERT OR REPLACE INTO fato_itens_ti VALUES (
                ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
            )
        """, (
            id_item,
            str(it.get("idCompra") or "").strip(),
            it.get("numeroControlePNCPCompra"),
            int(dt_inc[:4]) if len(dt_inc) >= 4 and dt_inc[:4].isdigit() else 2025,
            dt_inc[:7] if len(dt_inc) >= 7 else "2025-01",
            uasg,
            it.get("orgaoEntidadeCnpj"),
            it.get("numeroItemCompra"),
            it.get("materialOuServico"),
            it.get("materialOuServicoNome"),
            it.get("codigoGrupo"),
            it.get("codigoClasse"),
            it.get("codItemCatalogo"),
            cod_pdm,
            nome_pdm,
            desc_res,
            desc_det,
            validado_kw,
            it.get("unidadeMedida"),
            1 if it.get("orcamentoSigiloso") else 0,
            it.get("itemCategoriaNome"),
            it.get("criterioJulgamentoNome"),
            sit_nome,
            flag_fracasso,
            it.get("tipoBeneficioNome"),
            qtd,
            it.get("valorUnitarioEstimado"),
            val_tot,
            1 if it.get("temResultado") else 0,
            it.get("codFornecedor"),
            it.get("nomeFornecedor"),
            it.get("quantidadeResultado"),
            it.get("valorUnitarioResultado"),
            it.get("valorTotalResultado"),
            dt_inc,
            dt_atu,
            flag_alt,
            flag_erro
        ))


# ============================================================================
# TAREFA T2: COLETA DE DADOS (ITENS TI, CONTRATACOES, RESULTADOS, PCA E KPIS)
# ============================================================================
def gerar_janelas_mensais(anos: list[int]) -> list[tuple[str, str, int, int]]:
    hoje = datetime.now()
    janelas = []
    for ano in anos:
        for mes in range(1, 13):
            if ano == hoje.year and mes > hoje.month:
                break
            ultimo_dia = calendar.monthrange(ano, mes)[1]
            dt_ini = f"{ano}-{mes:02d}-01"
            dt_fim = f"{ano}-{mes:02d}-{ultimo_dia:02d}"
            janelas.append((dt_ini, dt_fim, ano, mes))
    return janelas


def executar_t2_coleta(conn: sqlite3.Connection, classes_mat: list[int], grupos_serv: list[int]):
    janelas = gerar_janelas_mensais(ANOS_ESCOPO)

    # 1. Coletar todas as Contratacoes do Tocantins (2024-2026) por Modalidade
    print("\n>>> [T2.1] Coletando Contratações do Tocantins (2024-2026)...", flush=True)
    for dt_ini, dt_fim, ano, mes in janelas:
        for cod_mod in MODALIDADES_PNCP.keys():
            chave_cp = f"contr_TO_{ano}_{mes:02d}_mod_{cod_mod}"
            if tarefa_concluida(conn, chave_cp):
                continue

            lote = coletar_todas_paginas(
                "/modulo-contratacoes/1_consultarContratacoes_PNCP_14133",
                {
                    "dataPublicacaoPncpInicial": dt_ini,
                    "dataPublicacaoPncpFinal": dt_fim,
                    "codigoModalidade": cod_mod,
                    "unidadeOrgaoUfSigla": "TO",
                    "tamanhoPagina": 500
                }
            )
            salvar_contratacoes_lote(conn, lote, "TO_GERAL")
            marcar_checkpoint(conn, chave_cp, len(lote))
            if lote:
                print(f"    [+] TO {ano}-{mes:02d} (Mod {cod_mod}): {len(lote)} compras", flush=True)

    # 2. Coletar Itens de TI no Brasil inteiro (filtrados por Classe CATMAT e Grupo CATSER)
    print("\n>>> [T2.2] Coletando Itens de TI Nacionais (CATMAT Grupo 70 e CATSER TIC)...", flush=True)
    for dt_ini, dt_fim, ano, mes in janelas:
        # 2a. Materiais de TI (por codigoClasse do Grupo 70)
        for cod_classe in classes_mat:
            chave_cp = f"itens_mat_{ano}_{mes:02d}_cls_{cod_classe}"
            if tarefa_concluida(conn, chave_cp):
                continue

            lote = coletar_todas_paginas(
                "/modulo-contratacoes/2_consultarItensContratacoes_PNCP_14133",
                {
                    "dataInclusaoPncpInicial": dt_ini,
                    "dataInclusaoPncpFinal": dt_fim,
                    "materialOuServico": "M",
                    "codigoClasse": cod_classe,
                    "tamanhoPagina": 500
                }
            )
            salvar_itens_lote(conn, lote)
            marcar_checkpoint(conn, chave_cp, len(lote))
            if lote:
                print(f"    [+] Material TI {ano}-{mes:02d} (Classe {cod_classe}): {len(lote)} itens", flush=True)

        # 2b. Serviços de TI (por codigoGrupo do CATSER)
        for cod_grupo in grupos_serv:
            chave_cp = f"itens_srv_{ano}_{mes:02d}_grp_{cod_grupo}"
            if tarefa_concluida(conn, chave_cp):
                continue

            lote = coletar_todas_paginas(
                "/modulo-contratacoes/2_consultarItensContratacoes_PNCP_14133",
                {
                    "dataInclusaoPncpInicial": dt_ini,
                    "dataInclusaoPncpFinal": dt_fim,
                    "materialOuServico": "S",
                    "codigoGrupo": cod_grupo,
                    "tamanhoPagina": 500
                }
            )
            salvar_itens_lote(conn, lote)
            marcar_checkpoint(conn, chave_cp, len(lote))
            if lote:
                print(f"    [+] Serviço TI {ano}-{mes:02d} (Grupo {cod_grupo}): {len(lote)} itens", flush=True)

    # 3. Buscar Cabeçalho das Contratações e Resultados dos Itens de TI (por idCompra)
    print("\n>>> [T2.3] Sincronizando Compras-Pai e Resultados para os Itens de TI...", flush=True)
    cur_missing = conn.execute("""
        SELECT DISTINCT i.id_compra
        FROM fato_itens_ti i
        LEFT JOIN fato_contratacoes c ON i.id_compra = c.id_compra
        WHERE c.id_compra IS NULL AND i.id_compra <> ''
    """)
    ids_compra_faltantes = [r[0] for r in cur_missing.fetchall()]
    print(f"    [*] Contratações-pai de TI para detalhar: {len(ids_compra_faltantes)}", flush=True)

    for idx, id_comp in enumerate(ids_compra_faltantes, 1):
        chave_cp = f"compra_id_{id_comp}"
        if not tarefa_concluida(conn, chave_cp):
            dados_c = requisitar_json(
                "/modulo-contratacoes/1.1_consultarContratacoes_PNCP_14133_Id",
                {"tipo": "idCompra", "codigo": id_comp}
            )
            lote_c = dados_c.get("resultado") or []
            salvar_contratacoes_lote(conn, lote_c, "BR_TI")
            marcar_checkpoint(conn, chave_cp, len(lote_c))

        # Busca também os resultados homologados dessa compra de TI
        chave_res = f"res_id_{id_comp}"
        if not tarefa_concluida(conn, chave_res):
            dados_r = requisitar_json(
                "/modulo-contratacoes/3.1_consultarResultadoItensContratacoes_PNCP_14133_Id",
                {"tipo": "idCompra", "codigo": id_comp}
            )
            lote_r = dados_r.get("resultado") or []
            for r in lote_r:
                id_it = str(r.get("idCompraItem") or "").strip()
                seq = r.get("sequencialResultado") or 1
                if not id_it:
                    continue
                porte = (r.get("porteFornecedorNome") or "").upper()
                flag_me = 1 if ("ME" in porte or "EPP" in porte or r.get("aplicacaoBeneficioMeepp")) else 0
                sit_res = r.get("situacaoCompraItemResultadoNome") or ""
                motivo_canc = r.get("motivoCancelamento")
                flag_canc_sem_motivo = 1 if ("cancelado" in sit_res.lower() and not motivo_canc) else 0

                conn.execute("""
                    INSERT OR REPLACE INTO fato_resultados_ti VALUES (
                        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
                    )
                """, (
                    id_it, seq, str(r.get("idCompra") or "").strip(),
                    str(r.get("unidadeOrgaoCodigoUnidade") or "").strip().zfill(6),
                    r.get("unidadeOrgaoUfSigla"), r.get("orgaoEntidadeCnpj"),
                    r.get("niFornecedor"), r.get("tipoPessoa"),
                    r.get("nomeRazaoSocialFornecedor"), r.get("porteFornecedorId"),
                    r.get("porteFornecedorNome"), flag_me,
                    str(r.get("naturezaJuridicaId") or ""), r.get("naturezaJuridicaNome"),
                    r.get("quantidadeHomologada"), r.get("valorUnitarioHomologado"),
                    r.get("valorTotalHomologado"), r.get("percentualDesconto"),
                    sit_res, motivo_canc, flag_canc_sem_motivo,
                    1 if r.get("aplicacaoBeneficioMeepp") else 0,
                    1 if r.get("aplicacaoMargemPreferencia") else 0,
                    r.get("dataResultadoPncp"), r.get("dataInclusaoPncp"),
                    r.get("dataAtualizacaoPncp")
                ))
            marcar_checkpoint(conn, chave_res, len(lote_r))

        if idx % 50 == 0:
            print(f"    -> Processadas {idx}/{len(ids_compra_faltantes)} compras de TI...", flush=True)

    # 4. Coletar PGC / PCA da UFT e do IFTO (2024, 2025, 2026)
    print("\n>>> [T2.4] Coletando PCA (PGC) da UFT e do IFTO (2024-2026)...", flush=True)
    set_grupos_serv_ti = set(grupos_serv)
    for cod_orgao, sigla in ORGAOS_PCA_TO.items():
        for ano in ANOS_ESCOPO:
            chave_cp = f"pca_{sigla}_{ano}"
            if tarefa_concluida(conn, chave_cp):
                continue

            lote_pca = coletar_todas_paginas(
                "/modulo-pgc/1_consultarPgcDetalhe",
                {"orgao": cod_orgao, "anoPcaProjetoCompra": ano, "tamanhoPagina": 500}
            )
            for idx_p, p in enumerate(lote_pca):
                chave_item = f"{sigla}_{ano}_{p.get('codigoUasg')}_{p.get('numeroArtefato')}_{p.get('ordemDfd')}_{p.get('codigoItemCatalogo')}_{idx_p}"
                grp_mat = p.get("codigoGrupoMaterial")
                grp_srv = p.get("codigoGrupoServico")
                desc_pca = f"{p.get('descricaoItemCatalogo') or ''} {p.get('descricaoObjetoDfd') or ''}"
                eh_ti = 1 if (grp_mat == 70 or grp_srv in set_grupos_serv_ti or REGEX_PALAVRAS_TI.search(desc_pca)) else 0

                conn.execute("""
                    INSERT OR REPLACE INTO fato_pca_to VALUES (
                        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
                    )
                """, (
                    chave_item, ano, cod_orgao, sigla,
                    str(p.get("codigoUasg") or "").strip().zfill(6), p.get("nomeUasg"),
                    p.get("numeroArtefato"), p.get("ordemDfd"), p.get("descricaoObjetoDfd"),
                    p.get("nivelPrioridadeDfd"), p.get("dataPrevistaFormalizacaoDemanda"),
                    p.get("tipoItem"), 1 if p.get("itemSustentavel") else 0,
                    grp_mat, p.get("nomeGrupoMaterial"),
                    p.get("codigoClasseMaterial"), p.get("nomeClasseMaterial"),
                    grp_srv, p.get("nomeGrupoServico"),
                    str(p.get("codigoItemCatalogo") or ""), p.get("descricaoItemCatalogo"),
                    p.get("quantidadeItem"), p.get("valorUnitarioItem"), p.get("valorTotalItem"),
                    eh_ti, p.get("dataHoraPublicacaoPncp")
                ))
            marcar_checkpoint(conn, chave_cp, len(lote_pca))
            print(f"    [+] PCA {sigla} ({ano}): {len(lote_pca)} itens planejados", flush=True)

    # 5. Coletar Indicadores de Desempenho da API (Módulo 97)
    print("\n>>> [T2.5] Coletando Indicadores da API (2024-2026)...", flush=True)
    for ano in ANOS_ESCOPO:
        dados_kpi = requisitar_json(
            "/modulo-indicadores/2_consultarIndicadoresPorPeriodo",
            {"ano": ano, "pagina": 1, "tamanhoPagina": 100}
        )
        for k in (dados_kpi.get("resultado") or []):
            ano_mes = k.get("anoMes") or f"{k.get('ano')}-{int(k.get('mes', 1)):02d}"
            conn.execute("""
                INSERT OR REPLACE INTO fato_indicadores_api VALUES (?,?,?,?,?,?,?,?)
            """, (
                ano_mes, k.get("ano"), k.get("mes"),
                k.get("totalServicos"), k.get("totalRequisicoes"),
                k.get("percentualSucesso"), k.get("mediaTempoRespostaMs"),
                k.get("totalDownloadGb")
            ))
    conn.commit()


# ============================================================================
# EXPORTACAO DO JSON CONSOLIDADO PARA O SITE NA VERCEL (CARREGAMENTO INSTANTANEO)
# ============================================================================
def exportar_json_para_vercel(conn: sqlite3.Connection):
    print("\n>>> [T3/Vercel] Gerando pacote JSON otimizado para o Dashboard Web...", flush=True)
    conn.row_factory = sqlite3.Row

    # 1. Série Mensal e Agregados para Filtros Globais (Páginas 1, 2 e 3)
    serie_cubo = [dict(r) for r in conn.execute("""
        SELECT
            c.ano_compra AS ano,
            c.mes_publicacao AS mes,
            COALESCE(c.uf, 'NI') AS uf,
            COALESCE(c.modalidade_nome, 'Outros') AS modalidade,
            COALESCE(c.tipo_contratacao, 'Com Competição') AS tipo_contratacao,
            COALESCE(c.orgao_razao_social, 'Órgão Não Informado') AS orgao,
            COALESCE(i.material_ou_servico_nome, 'Geral') AS tipo_item,
            COUNT(DISTINCT c.id_compra) AS qtd_contratacoes,
            COUNT(i.id_compra_item) AS qtd_itens,
            ROUND(SUM(COALESCE(i.valor_total, c.valor_total_estimado, 0)), 2) AS valor_estimado,
            ROUND(SUM(COALESCE(i.valor_total_resultado, c.valor_total_homologado, 0)), 2) AS valor_homologado,
            ROUND(AVG(c.prazo_dias), 1) AS prazo_medio_dias,
            SUM(c.flag_orcamento_sigiloso) AS qtd_sigiloso,
            SUM(c.flag_alterado_apos_publicacao) AS qtd_alterados,
            SUM(c.flag_valor_nulo_ou_zerado) AS qtd_nulos_zerados,
            SUM(COALESCE(i.flag_fracasso_deserto_cancelado, 0)) AS qtd_itens_fracassados
        FROM fato_contratacoes c
        LEFT JOIN fato_itens_ti i ON c.id_compra = i.id_compra
        WHERE c.contratacao_excluida = 0
        GROUP BY 1, 2, 3, 4, 5, 6, 7
    """).fetchall()]

    # 2. Top Fornecedores e Participação ME/EPP (Página 4)
    fornecedores = [dict(r) for r in conn.execute("""
        SELECT
            r.ni_fornecedor,
            r.nome_razao_social_fornecedor AS fornecedor,
            COALESCE(r.porte_fornecedor_nome, 'Não Informado') AS porte,
            r.flag_me_epp,
            COALESCE(c.modalidade_nome, 'Outros') AS modalidade,
            COALESCE(c.ano_compra, 2025) AS ano,
            COUNT(DISTINCT r.id_compra_item) AS itens_vencidos,
            ROUND(SUM(COALESCE(r.valor_total_homologado, 0)), 2) AS valor_homologado,
            ROUND(AVG(COALESCE(r.percentual_desconto, 0)), 2) AS desconto_medio
        FROM fato_resultados_ti r
        LEFT JOIN fato_contratacoes c ON r.id_compra = c.id_compra
        GROUP BY 1, 2, 3, 4, 5, 6
        ORDER BY valor_homologado DESC
        LIMIT 200
    """).fetchall()]

    # 3. Histograma das Dispensas Art. 75, II - Análise de Fracionamento (Página 4)
    histograma_dispensa = [dict(r) for r in conn.execute("""
        SELECT
            ano_compra AS ano,
            uf,
            CASE
                WHEN pct_limite_dispensa < 20 THEN '0% a 20% do Teto'
                WHEN pct_limite_dispensa < 40 THEN '20% a 40% do Teto'
                WHEN pct_limite_dispensa < 60 THEN '40% a 60% do Teto'
                WHEN pct_limite_dispensa < 80 THEN '60% a 80% do Teto'
                WHEN pct_limite_dispensa < 90 THEN '80% a 90% do Teto'
                WHEN pct_limite_dispensa <= 100 THEN '90% a 100% (Zona de Atenção!)'
                ELSE 'Acima do Teto (Outras Hipóteses)'
            END AS faixa_teto,
            COUNT(*) AS qtd_dispensas,
            ROUND(SUM(valor_total_estimado), 2) AS valor_total
        FROM fato_contratacoes
        WHERE codigo_modalidade = 8
          AND valor_total_estimado > 0
          AND pct_limite_dispensa IS NOT NULL
        GROUP BY 1, 2, 3
    """).fetchall()]

    # 4. Planejado (PCA) vs Executado - UFT e IFTO (Página 5)
    pca_resumo = [dict(r) for r in conn.execute("""
        SELECT
            ano_pca AS ano,
            sigla_instituicao AS instituicao,
            tipo_item,
            flag_item_ti,
            COUNT(*) AS qtd_itens_planejados,
            ROUND(SUM(COALESCE(valor_total_item, 0)), 2) AS valor_planejado,
            SUM(item_sustentavel) AS itens_sustentaveis
        FROM fato_pca_to
        GROUP BY 1, 2, 3, 4
    """).fetchall()]

    # 5. Indicadores da API (Página 6)
    kpis_api = [dict(r) for r in conn.execute("""
        SELECT * FROM fato_indicadores_api ORDER BY ano_mes ASC
    """).fetchall()]

    # 6. Catálogo de TI utilizado (Documentação T1)
    catalogo_ti = [dict(r) for r in conn.execute("""
        SELECT * FROM dim_catalogo_ti ORDER BY tipo_item, codigo_classe
    """).fetchall()]

    pacote_dashboard = {
        "gerado_em": datetime.now().isoformat(timespec="seconds"),
        "escopo_anos": ANOS_ESCOPO,
        "tetos_dispensa": TETO_DISPENSA_ART75_II,
        "catalogo_ti": catalogo_ti,
        "cubo_contratacoes": serie_cubo,
        "top_fornecedores": fornecedores,
        "histograma_dispensa": histograma_dispensa,
        "pca_uft_ifto": pca_resumo,
        "indicadores_api": kpis_api
    }

    caminho_json = PUBLIC_DATA_DIR / "dashboard_data.json"
    with open(caminho_json, "w", encoding="utf-8") as f:
        json.dump(pacote_dashboard, f, ensure_ascii=False, indent=2)

    tam_kb = caminho_json.stat().st_size / 1024
    print(f"    [SUCESSO!] JSON para Vercel gerado: {caminho_json} ({tam_kb:.1f} KB)", flush=True)


def main():
    conn = conectar_db()
    inicializar_schema(conn)

    classes_mat, grupos_serv = executar_t1_catalogo_ti(conn)
    executar_t2_coleta(conn, classes_mat, grupos_serv)
    exportar_json_para_vercel(conn)

    conn.close()
    print("\n>>> Pipeline finalizado com sucesso!", flush=True)


if __name__ == "__main__":
    main()
