import json
from datetime import datetime
from typing import Any, Dict, List
from config import ANOS_ESCOPO, PUBLIC_DATA_DIR, TETO_DISPENSA_ART75_II
import db


def query_to_dicts_sqlite(conn: Any, query: str) -> List[Dict[str, Any]]:
    cur = conn.execute(query)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def query_to_dicts_postgres(conn: Any, query: str) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(query)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def exportar_dashboard_json(prefer_neon: bool = True) -> str:
    """
    Consolida as análises do COBIT 5 a partir do Neon PostgreSQL ou SQLite
    e exporta o cubo analítico para public_data/dashboard_data.json.
    """
    print("\n>>> [Export] Gerando cubo analítico consolidado para Vercel...", flush=True)

    conn_pg = db.get_neon_connection() if prefer_neon else None
    if conn_pg:
        print("    [*] Fonte de dados selecionada: Neon PostgreSQL")
        query_fn = query_to_dicts_postgres
        conn = conn_pg
        is_pg = True
    else:
        print("    [*] Fonte de dados selecionada: SQLite Local")
        query_fn = query_to_dicts_sqlite
        conn = db.get_sqlite_connection()
        is_pg = False

    try:
        # 1. Cubo Analítico (Série Mensal e Filtros Globais)
        sql_cubo = """
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
                ROUND(CAST(SUM(COALESCE(i.valor_total, c.valor_total_estimado, 0)) AS NUMERIC), 2) AS valor_estimado,
                ROUND(CAST(SUM(COALESCE(i.valor_total_resultado, c.valor_total_homologado, 0)) AS NUMERIC), 2) AS valor_homologado,
                ROUND(CAST(AVG(c.prazo_dias) AS NUMERIC), 1) AS prazo_medio_dias,
                SUM(c.flag_orcamento_sigiloso) AS qtd_sigiloso,
                SUM(c.flag_alterado_apos_publicacao) AS qtd_alterados,
                SUM(c.flag_valor_nulo_ou_zerado) AS qtd_nulos_zerados,
                SUM(COALESCE(i.flag_fracasso_deserto_cancelado, 0)) AS qtd_itens_fracassados
            FROM fato_contratacoes c
            LEFT JOIN fato_itens_ti i ON c.id_compra = i.id_compra
            WHERE c.contratacao_excluida = 0
            GROUP BY 1, 2, 3, 4, 5, 6, 7
        """ if is_pg else """
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
        """
        serie_cubo = query_fn(conn, sql_cubo)

        # 2. Curva de Fornecedores e ME/EPP
        sql_forn = """
            SELECT
                r.ni_fornecedor,
                r.nome_razao_social_fornecedor AS fornecedor,
                COALESCE(r.porte_fornecedor_nome, 'Não Informado') AS porte,
                r.flag_me_epp,
                COALESCE(c.modalidade_nome, 'Outros') AS modalidade,
                COALESCE(c.ano_compra, 2025) AS ano,
                COUNT(DISTINCT r.id_compra_item) AS itens_vencidos,
                ROUND(CAST(SUM(COALESCE(r.valor_total_homologado, 0)) AS NUMERIC), 2) AS valor_homologado,
                ROUND(CAST(AVG(COALESCE(r.percentual_desconto, 0)) AS NUMERIC), 2) AS desconto_medio
            FROM fato_resultados_ti r
            LEFT JOIN fato_contratacoes c ON r.id_compra = c.id_compra
            GROUP BY 1, 2, 3, 4, 5, 6
            ORDER BY valor_homologado DESC
            LIMIT 200
        """ if is_pg else """
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
        """
        top_fornecedores = query_fn(conn, sql_forn)

        # 3. Histograma de Dispensas do Art. 75, II (Risco de Fracionamento)
        sql_disp = """
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
                ROUND(CAST(SUM(valor_total_estimado) AS NUMERIC), 2) AS valor_total
            FROM fato_contratacoes
            WHERE codigo_modalidade = 8
              AND valor_total_estimado > 0
              AND pct_limite_dispensa IS NOT NULL
            GROUP BY 1, 2, 3
        """ if is_pg else """
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
        """
        histograma_dispensa = query_fn(conn, sql_disp)

        # 4. Planejado vs Executado (PCA UFT e IFTO)
        sql_pca = """
            SELECT
                ano_pca AS ano,
                sigla_instituicao AS instituicao,
                tipo_item,
                flag_item_ti,
                COUNT(*) AS qtd_itens_planejados,
                ROUND(CAST(SUM(COALESCE(valor_total_item, 0)) AS NUMERIC), 2) AS valor_planejado,
                SUM(item_sustentavel) AS itens_sustentaveis
            FROM fato_pca_to
            GROUP BY 1, 2, 3, 4
        """ if is_pg else """
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
        """
        pca_resumo = query_fn(conn, sql_pca)

        # 5. Indicadores da API
        sql_ind = "SELECT * FROM fato_indicadores_api ORDER BY ano_mes ASC"
        indicadores_api = query_fn(conn, sql_ind)

        # 6. Catálogo de TI (T1)
        sql_cat = "SELECT * FROM dim_catalogo_ti ORDER BY tipo_item, codigo_classe"
        catalogo_ti = query_fn(conn, sql_cat)

        pacote = {
            "gerado_em": datetime.now().isoformat(timespec="seconds"),
            "fonte": "Neon PostgreSQL" if is_pg else "SQLite Local",
            "escopo_anos": ANOS_ESCOPO,
            "tetos_dispensa": TETO_DISPENSA_ART75_II,
            "catalogo_ti": catalogo_ti,
            "cubo_contratacoes": serie_cubo,
            "top_fornecedores": top_fornecedores,
            "histograma_dispensa": histograma_dispensa,
            "pca_uft_ifto": pca_resumo,
            "indicadores_api": indicadores_api
        }

        # Converte tipos não serializáveis (ex: Decimal do Postgres) para float/int
        def default_serializer(o):
            if hasattr(o, "__float__"):
                return float(o)
            return str(o)

        caminho_json = PUBLIC_DATA_DIR / "dashboard_data.json"
        with open(caminho_json, "w", encoding="utf-8") as f:
            json.dump(pacote, f, ensure_ascii=False, indent=2, default=default_serializer)

        tam_kb = caminho_json.stat().st_size / 1024
        print(f"    [SUCESSO] JSON gerado: {caminho_json} ({tam_kb:.1f} KB)", flush=True)
        return str(caminho_json)

    finally:
        conn.close()
