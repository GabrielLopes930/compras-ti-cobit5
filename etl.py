import calendar
import hashlib
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import requests

from config import (
    ANOS_ESCOPO,
    BASE_URL,
    DESCRICAO_MAX_CHARS,
    MODALIDADES_PNCP,
    ORGAOS_PCA_TO,
    REGEX_PALAVRAS_TI,
    TETO_DISPENSA_ART75_II,
    USER_AGENT,
)
import db

session = requests.Session()
session.headers.update({
    "Accept": "application/json",
    "User-Agent": USER_AGENT
})


# ============================================================================
# CLIENTE HTTP COM RETRY E BACKOFF EXPONENCIAL
# ============================================================================
def requisitar_json(path: str, params: dict, tentativas: int = 5) -> Optional[dict]:
    """
    Retorna o JSON da resposta; {} quando a API responde que não há dados (204/404);
    None quando a requisição falhou. Quem chama não deve marcar checkpoint com None,
    para que a janela seja coletada de novo na próxima execução.
    """
    url = f"{BASE_URL}{path}"
    for t in range(1, tentativas + 1):
        try:
            resp = session.get(url, params=params, timeout=60)
            if resp.status_code == 200:
                return resp.json() if resp.content else {}
            elif resp.status_code in (204, 404):
                return {}
            elif resp.status_code in (429, 500, 502, 503, 504):
                espera = min(t * 5, 60)
                print(f"    [!] HTTP {resp.status_code} em {path}. Aguardando {espera:.1f}s...", flush=True)
                time.sleep(espera)
            else:
                print(f"    [X] HTTP {resp.status_code} em {path} {params}: {resp.text[:150]}", flush=True)
                return None
        except Exception as e:
            if t == tentativas:
                print(f"    [X] Falha de rede após {tentativas} tentativas em {path}: {e}", flush=True)
            time.sleep(t * 3)
    return None


def coletar_todas_paginas(path: str, params_base: dict, max_paginas: int = 200) -> Optional[list]:
    """Retorna todos os registros, ou None se alguma página falhar (janela incompleta)."""
    registros = []
    pagina = 1
    while pagina <= max_paginas:
        params = params_base.copy()
        params["pagina"] = pagina
        if "tamanhoPagina" not in params:
            params["tamanhoPagina"] = 500

        dados = requisitar_json(path, params)
        if dados is None:
            return None
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
# CHECKPOINT
# ============================================================================
def tarefa_concluida(chave: str) -> bool:
    conn = db.get_sqlite_connection()
    cur = conn.execute(
        "SELECT concluido FROM etl_checkpoints WHERE chave_tarefa = ?",
        (chave,)
    )
    row = cur.fetchone()
    conn.close()
    return bool(row and row[0] == 1)


def marcar_checkpoint(chave: str, qtd: int):
    agora = datetime.now().isoformat(timespec="seconds")
    conexoes = db.get_active_connections()
    for sgbd, conn in conexoes:
        is_pg = "PostgreSQL" in sgbd
        db.upsert_records(
            conn=conn,
            table_name="etl_checkpoints",
            pk_cols=["chave_tarefa"],
            columns=["chave_tarefa", "concluido", "total_registros", "updated_at"],
            rows=[(chave, 1, qtd, agora)],
            is_postgres=is_pg
        )
        conn.close()


# ============================================================================
# FUNCOES DE SUPORTE E FORMATACAO
# ============================================================================
def calcular_dias(dt_ini: str, dt_fim: str) -> Optional[int]:
    if not dt_ini or not dt_fim:
        return None
    try:
        d1 = datetime.fromisoformat(dt_ini[:19])
        d2 = datetime.fromisoformat(dt_fim[:19])
        return max(0, (d2 - d1).days)
    except Exception:
        return None


def formatar_linhas_contratacoes(lote: list, escopo: str) -> List[Tuple]:
    linhas = []
    for c in lote:
        id_compra = str(c.get("idCompra") or "").strip()
        if not id_compra:
            continue

        dt_pub = c.get("dataPublicacaoPncp") or ""
        dt_inc = c.get("dataInclusaoPncp") or ""
        dt_atu = c.get("dataAtualizacaoPncp") or ""
        dt_enc = c.get("dataEncerramentoPropostaPncp") or ""

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

        linhas.append((
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
    return linhas


def formatar_linhas_itens(lote: list) -> List[Tuple]:
    linhas = []
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

        linhas.append((
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
            desc_det[:DESCRICAO_MAX_CHARS],
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
    return linhas


def persistir_em_todos_sgbds(table_name: str, pk_cols: List[str], columns: List[str], rows: List[Tuple]) -> Dict[str, Dict[str, int]]:
    """Persiste os dados em lote no Neon e no SQLite simultaneamente, reportando as métricas de Upsert."""
    resumo_geral = {}
    conexoes = db.get_active_connections()
    for sgbd, conn in conexoes:
        is_pg = "PostgreSQL" in sgbd
        res = db.upsert_records(conn, table_name, pk_cols, columns, rows, is_postgres=is_pg)
        resumo_geral[sgbd] = res
        conn.close()
    return resumo_geral


# ============================================================================
# TAREFA T1: CATALOGO DE TI (CATMAT E CATSER)
# ============================================================================
def executar_t1_catalogo() -> Tuple[List[int], List[int]]:
    print("\n>>> [T1] Mapeando códigos de TI no CATMAT (Grupo 70) e CATSER TIC...", flush=True)
    rows_catalogo = []

    # 1. Classes do Grupo 70 do CATMAT
    dados_mat = requisitar_json(
        "/modulo-material/2_consultarClasseMaterial",
        {"codigoGrupo": 70, "statusClasse": True, "pagina": 1}
    )
    for c in ((dados_mat or {}).get("resultado") or []):
        rows_catalogo.append((
            "M",
            c.get("codigoGrupo", 70),
            c.get("nomeGrupo", "EQUIPAMENTO E SUPRIMENTO DE INFORMÁTICA"),
            c.get("codigoClasse"),
            c.get("nomeClasse")
        ))

    # 2. Grupos de Serviço de TIC (Seção 1)
    dados_div = requisitar_json(
        "/modulo-servico/2_consultarDivisaoServico",
        {"codigoSecao": 1, "statusDivisao": True, "pagina": 1}
    )
    divisoes = [d.get("codigoDivisao") for d in ((dados_div or {}).get("resultado") or [])]
    if 11 not in divisoes:
        divisoes.append(11)

    for div in divisoes:
        dados_grp = requisitar_json(
            "/modulo-servico/3_consultarGrupoServico",
            {"codigoDivisao": div, "statusGrupo": True, "pagina": 1}
        )
        for g in ((dados_grp or {}).get("resultado") or []):
            cod_g = g.get("codigoGrupo")
            rows_catalogo.append((
                "S",
                cod_g,
                g.get("nomeGrupo"),
                cod_g,
                g.get("nomeDivisao")
            ))

    cols = ["tipo_item", "codigo_grupo", "nome_grupo", "codigo_classe", "nome_classe"]
    res = persistir_em_todos_sgbds("dim_catalogo_ti", ["tipo_item", "codigo_classe"], cols, rows_catalogo)

    # Identifica listas
    classes_mat = [r[3] for r in rows_catalogo if r[0] == "M"]
    grupos_serv = [r[1] for r in rows_catalogo if r[0] == "S"]

    print(f"    [+] T1 Concluída: {len(classes_mat)} classes CATMAT e {len(grupos_serv)} grupos CATSER.", flush=True)
    for sgbd, metricas in res.items():
        print(f"    [{sgbd}] Inseridos: {metricas['inserted']} | Atualizados: {metricas['updated']}")

    return classes_mat, grupos_serv


# ============================================================================
# AUXILIARES DA T2
# ============================================================================
def eh_me_epp(porte_nome: Optional[str]) -> bool:
    """
    ME/EPP pelo porte informado. Compara o nome inteiro (ME, EPP, Microempresa,
    Empresa de Pequeno Porte), para não confundir "DEMAIS" com "ME".
    """
    p = (porte_nome or "").strip().upper()
    if p in ("ME", "EPP", "ME/EPP", "MEI"):
        return True
    return p.startswith("MICRO") or "PEQUENO PORTE" in p


def coletar_pca_to(anos: List[int], classes_mat: List[int], grupos_serv: List[int]):
    """Coleta o Plano de Contratações Anual (PGC) da UFT e do IFTO para o planejado x executado."""
    print("\n>>> [T2.1b] Coletando PCA (PGC) da UFT e do IFTO...", flush=True)
    cols_pca = [
        "id_pca_key", "ano_pca", "orgao", "sigla_instituicao", "codigo_uasg", "nome_uasg",
        "numero_artefato", "ordem_dfd", "descricao_objeto_dfd", "nivel_prioridade_dfd",
        "data_prevista_formalizacao", "tipo_item", "item_sustentavel",
        "codigo_grupo_material", "nome_grupo_material", "codigo_classe_material", "nome_classe_material",
        "codigo_grupo_servico", "nome_grupo_servico", "codigo_item_catalogo", "descricao_item_catalogo",
        "quantidade_item", "valor_unitario_item", "valor_total_item", "flag_item_ti",
        "data_hora_publicacao_pncp"
    ]
    classes_mat = set(classes_mat or [])
    grupos_serv = set(grupos_serv or [])
    for ano in anos:
        for orgao, sigla in ORGAOS_PCA_TO.items():
            chave_cp = f"pca_{orgao}_{ano}"
            if tarefa_concluida(chave_cp):
                continue
            lote = coletar_todas_paginas(
                "/modulo-pgc/1_consultarPgcDetalhe",
                {"orgao": orgao, "anoPcaProjetoCompra": ano, "tamanhoPagina": 500}
            )
            if lote is None:
                print(f"    [X] PCA {sigla} {ano}: falha na coleta, será repetida", flush=True)
                continue
            linhas = []
            vistos = set()
            for p in lote:
                base = "|".join(str(p.get(k) or "") for k in (
                    "codigoUasg", "numeroArtefato", "ordemDfd", "numeroItemPncp", "codigoItemCatalogo"))
                chave = f"{orgao}|{ano}|{hashlib.md5(base.encode()).hexdigest()[:16]}"
                if chave in vistos:  # mesmo item repetido na resposta
                    continue
                vistos.add(chave)
                cls_m = p.get("codigoClasseMaterial")
                grp_s = p.get("codigoGrupoServico")
                flag_ti = 1 if (p.get("codigoGrupoMaterial") == 70 or cls_m in classes_mat
                                or grp_s in grupos_serv) else 0
                linhas.append((
                    chave, ano, orgao, sigla, p.get("codigoUasg"), p.get("nomeUasg"),
                    p.get("numeroArtefato"), p.get("ordemDfd"),
                    (p.get("descricaoObjetoDfd") or "")[:DESCRICAO_MAX_CHARS],
                    p.get("nivelPrioridadeDfd"), p.get("dataPrevistaFormalizacaoDemanda"),
                    p.get("tipoItem"), 1 if p.get("itemSustentavel") else 0,
                    p.get("codigoGrupoMaterial"), p.get("nomeGrupoMaterial"),
                    cls_m, p.get("nomeClasseMaterial"),
                    grp_s, p.get("nomeGrupoServico"),
                    str(p.get("codigoItemCatalogo") or ""),
                    (p.get("descricaoItemCatalogo") or "")[:DESCRICAO_MAX_CHARS],
                    p.get("quantidadeItem"), p.get("valorUnitarioItem"), p.get("valorTotalItem"),
                    flag_ti, p.get("dataHoraPublicacaoPncp")
                ))
            if linhas:
                persistir_em_todos_sgbds("fato_pca_to", ["id_pca_key"], cols_pca, linhas)
            print(f"    [+] PCA {sigla} {ano}: {len(linhas)} itens planejados "
                  f"({sum(l[24] for l in linhas)} de TI)", flush=True)
            marcar_checkpoint(chave_cp, len(linhas))


# ============================================================================
# TAREFA T2: COLETA DE DADOS (CONTRATACOES, ITENS, RESULTADOS, PCA, KPIS)
# ============================================================================
def gerar_janelas_mensais(anos: List[int]) -> List[Tuple[str, str, int, int]]:
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


def executar_t2_coleta(
    anos: List[int] = ANOS_ESCOPO,
    classes_mat: Optional[List[int]] = None,
    grupos_serv: Optional[List[int]] = None,
    apenas_to: bool = False
):
    if not classes_mat or not grupos_serv:
        # Busca do banco local se não fornecido
        conn = db.get_sqlite_connection()
        cur_m = conn.execute("SELECT codigo_classe FROM dim_catalogo_ti WHERE tipo_item = 'M'")
        classes_mat = [r[0] for r in cur_m.fetchall()]
        cur_s = conn.execute("SELECT codigo_grupo FROM dim_catalogo_ti WHERE tipo_item = 'S'")
        grupos_serv = [r[0] for r in cur_s.fetchall()]
        conn.close()

    janelas = gerar_janelas_mensais(anos)

    # 1. Contratações do Tocantins
    print("\n>>> [T2.1] Coletando Contratações do Tocantins (UF=TO)...", flush=True)
    cols_contr = [
        "id_compra", "numero_controle_pncp", "ano_compra", "mes_publicacao", "codigo_orgao",
        "orgao_cnpj", "orgao_razao_social", "orgao_esfera", "orgao_poder", "codigo_uasg",
        "nome_uasg", "uf", "municipio", "codigo_ibge", "codigo_modalidade",
        "modalidade_nome", "tipo_contratacao", "modo_disputa_nome", "amparo_legal_codigo",
        "amparo_legal_nome", "amparo_legal_descricao", "srp", "orcamento_sigiloso_descricao",
        "flag_orcamento_sigiloso", "situacao_compra_nome", "objeto_compra", "valor_total_estimado",
        "valor_total_homologado", "economia_reais", "economia_percentual", "teto_dispensa_ano",
        "pct_limite_dispensa", "data_publicacao_pncp", "data_abertura_proposta",
        "data_encerramento_proposta", "prazo_dias", "data_inclusao_pncp", "data_atualizacao_pncp",
        "flag_alterado_apos_publicacao", "flag_valor_nulo_ou_zerado", "contratacao_excluida",
        "escopo_origem"
    ]

    for dt_ini, dt_fim, ano, mes in janelas:
        for cod_mod in MODALIDADES_PNCP.keys():
            chave_cp = f"contr_TO_{ano}_{mes:02d}_mod_{cod_mod}"
            if tarefa_concluida(chave_cp):
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
            if lote is None:
                print(f"    [X] TO {ano}-{mes:02d} (Mod {cod_mod}): falha na coleta, será repetida na próxima execução", flush=True)
                continue
            linhas = formatar_linhas_contratacoes(lote, "TO_GERAL")
            if linhas:
                persistir_em_todos_sgbds("fato_contratacoes", ["id_compra"], cols_contr, linhas)
                print(f"    [+] TO {ano}-{mes:02d} (Mod {cod_mod}): {len(linhas)} compras", flush=True)
            marcar_checkpoint(chave_cp, len(linhas))

    # 1.1 Plano de Contratações Anual (PCA) da UFT e do IFTO
    coletar_pca_to(anos, classes_mat, grupos_serv)

    if apenas_to:
        print("    [*] Coleta restrita a TO finalizada.", flush=True)
        return

    # 2. Itens de TI Nacionais
    print("\n>>> [T2.2] Coletando Itens de TI Nacionais (CATMAT Grupo 70 e CATSER TIC)...", flush=True)
    cols_itens = [
        "id_compra_item", "id_compra", "numero_controle_pncp_compra", "ano_inclusao", "mes_inclusao",
        "codigo_uasg", "orgao_cnpj", "numero_item_compra", "material_ou_servico", "material_ou_servico_nome",
        "codigo_grupo", "codigo_classe", "cod_item_catalogo", "codigo_pdm", "nome_pdm",
        "descricao_resumida", "descricao_detalhada", "validado_palavra_chave_ti", "unidade_medida",
        "orcamento_sigiloso", "item_categoria_nome", "criterio_julgamento_nome", "situacao_compra_item_nome",
        "flag_fracasso_deserto_cancelado", "tipo_beneficio_nome", "quantidade", "valor_unitario_estimado",
        "valor_total", "tem_resultado", "cod_fornecedor", "nome_fornecedor",
        "quantidade_resultado", "valor_unitario_resultado", "valor_total_resultado",
        "data_inclusao_pncp", "data_atualizacao_pncp", "flag_item_alterado", "flag_erro_cadastro"
    ]

    for dt_ini, dt_fim, ano, mes in janelas:
        for cod_classe in classes_mat:
            chave_cp = f"itens_mat_{ano}_{mes:02d}_cls_{cod_classe}"
            if tarefa_concluida(chave_cp):
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
            if lote is None:
                print(f"    [X] Material TI {ano}-{mes:02d} (Classe {cod_classe}): falha, será repetida", flush=True)
                continue
            linhas = formatar_linhas_itens(lote)
            if linhas:
                persistir_em_todos_sgbds("fato_itens_ti", ["id_compra_item"], cols_itens, linhas)
                print(f"    [+] Material TI {ano}-{mes:02d} (Classe {cod_classe}): {len(linhas)} itens", flush=True)
            marcar_checkpoint(chave_cp, len(linhas))

        for cod_grupo in grupos_serv:
            chave_cp = f"itens_srv_{ano}_{mes:02d}_grp_{cod_grupo}"
            if tarefa_concluida(chave_cp):
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
            if lote is None:
                print(f"    [X] Serviço TI {ano}-{mes:02d} (Grupo {cod_grupo}): falha, será repetida", flush=True)
                continue
            linhas = formatar_linhas_itens(lote)
            if linhas:
                persistir_em_todos_sgbds("fato_itens_ti", ["id_compra_item"], cols_itens, linhas)
                print(f"    [+] Serviço TI {ano}-{mes:02d} (Grupo {cod_grupo}): {len(linhas)} itens", flush=True)
            marcar_checkpoint(chave_cp, len(linhas))

    # 3. Compras-pai e Resultados Homologados de TI
    print("\n>>> [T2.3] Sincronizando Compras-Pai e Resultados Homologados...", flush=True)
    conn = db.get_sqlite_connection()
    # Todas as compras que têm itens de TI: a compra-pai só é buscada se faltar,
    # mas os resultados são buscados para todas (inclusive compras do TO já gravadas).
    ids_faltantes = [r[0] for r in conn.execute("""
        SELECT DISTINCT i.id_compra
        FROM fato_itens_ti i
        WHERE i.id_compra <> ''
    """).fetchall()]
    ids_com_contratacao = {r[0] for r in conn.execute("SELECT id_compra FROM fato_contratacoes").fetchall()}
    itens_ti = {r[0] for r in conn.execute("SELECT id_compra_item FROM fato_itens_ti").fetchall()}
    conn.close()

    cols_res = [
        "id_compra_item", "sequencial_resultado", "id_compra", "codigo_uasg", "uf_uasg",
        "orgao_cnpj", "ni_fornecedor", "tipo_pessoa", "nome_razao_social_fornecedor",
        "porte_fornecedor_id", "porte_fornecedor_nome", "flag_me_epp", "natureza_juridica_id",
        "natureza_juridica_nome", "quantidade_homologada", "valor_unitario_homologado",
        "valor_total_homologado", "percentual_desconto", "situacao_resultado_nome",
        "motivo_cancelamento", "flag_cancelado_sem_motivo", "aplicacao_beneficio_meepp",
        "aplicacao_margem_preferencia", "data_resultado_pncp", "data_inclusao_pncp",
        "data_atualizacao_pncp"
    ]

    for idx, id_comp in enumerate(ids_faltantes, 1):
        chave_cp = f"compra_id_{id_comp}"
        if id_comp not in ids_com_contratacao and not tarefa_concluida(chave_cp):
            dados_c = requisitar_json(
                "/modulo-contratacoes/1.1_consultarContratacoes_PNCP_14133_Id",
                {"tipo": "idCompra", "codigo": id_comp}
            )
            if dados_c is not None:
                lote_c = dados_c.get("resultado") or []
                linhas_c = formatar_linhas_contratacoes(lote_c, "BR_TI")
                if linhas_c:
                    persistir_em_todos_sgbds("fato_contratacoes", ["id_compra"], cols_contr, linhas_c)
                marcar_checkpoint(chave_cp, len(linhas_c))

        chave_res = f"res_id_{id_comp}"
        if not tarefa_concluida(chave_res):
            dados_r = requisitar_json(
                "/modulo-contratacoes/3.1_consultarResultadoItensContratacoes_PNCP_14133_Id",
                {"tipo": "idCompra", "codigo": id_comp}
            )
            if dados_r is None:
                continue  # falhou: tenta de novo na próxima execução
            linhas_r = []
            for r in (dados_r.get("resultado") or []):
                id_it = str(r.get("idCompraItem") or "").strip()
                seq = r.get("sequencialResultado") or 1
                if not id_it or id_it not in itens_ti:
                    continue  # guarda só resultados de itens de TI
                flag_me = 1 if eh_me_epp(r.get("porteFornecedorNome")) else 0
                sit_res = r.get("situacaoCompraItemResultadoNome") or ""
                motivo_canc = r.get("motivoCancelamento")
                flag_canc_sem_motivo = 1 if ("cancelado" in sit_res.lower() and not motivo_canc) else 0

                linhas_r.append((
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
            if linhas_r:
                persistir_em_todos_sgbds("fato_resultados_ti", ["id_compra_item", "sequencial_resultado"], cols_res, linhas_r)
            marcar_checkpoint(chave_res, len(linhas_r))

        if idx % 50 == 0:
            print(f"    -> Processadas {idx}/{len(ids_faltantes)} compras de TI...", flush=True)

    # 4. Indicadores de Desempenho da API (2025-2026)
    print("\n>>> [T2.4] Coletando Indicadores de Desempenho da API...", flush=True)
    cols_ind = [
        "ano_mes", "ano", "mes", "total_servicos", "total_requisicoes",
        "percentual_sucesso", "media_tempo_resposta_ms", "total_download_gb"
    ]
    for ano in anos:
        dados_kpi = requisitar_json(
            "/modulo-indicadores/2_consultarIndicadoresPorPeriodo",
            {"ano": ano, "pagina": 1, "tamanhoPagina": 100}
        )
        linhas_kpi = []
        for k in ((dados_kpi or {}).get("resultado") or []):
            ano_mes = k.get("anoMes") or f"{k.get('ano')}-{int(k.get('mes', 1)):02d}"
            linhas_kpi.append((
                ano_mes, k.get("ano"), k.get("mes"),
                k.get("totalServicos"), k.get("totalRequisicoes"),
                k.get("percentualSucesso"), k.get("mediaTempoRespostaMs"),
                k.get("totalDownloadGb")
            ))
        if linhas_kpi:
            persistir_em_todos_sgbds("fato_indicadores_api", ["ano_mes"], cols_ind, linhas_kpi)
            print(f"    [+] Indicadores {ano}: {len(linhas_kpi)} meses", flush=True)
