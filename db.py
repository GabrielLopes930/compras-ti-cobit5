import sqlite3
from typing import Any, Dict, List, Optional, Tuple
from config import DATABASE_URL, DB_PATH

try:
    import psycopg2
    from psycopg2.extras import execute_batch
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False


# ============================================================================
# DEFINICOES DE ESQUEMA DDL (POSTGRESQL E SQLITE)
# ============================================================================
TABLE_NAMES = [
    "etl_checkpoints",
    "dim_catalogo_ti",
    "fato_contratacoes",
    "fato_itens_ti",
    "fato_resultados_ti",
    "fato_pca_to",
    "fato_indicadores_api"
]

SCHEMAS_POSTGRES = {
    "etl_checkpoints": """
        CREATE TABLE IF NOT EXISTS etl_checkpoints (
            chave_tarefa VARCHAR(150) PRIMARY KEY,
            concluido INTEGER DEFAULT 0,
            total_registros INTEGER DEFAULT 0,
            updated_at VARCHAR(30)
        );
    """,
    "dim_catalogo_ti": """
        CREATE TABLE IF NOT EXISTS dim_catalogo_ti (
            tipo_item VARCHAR(2) NOT NULL,
            codigo_grupo INTEGER,
            nome_grupo TEXT,
            codigo_classe INTEGER NOT NULL,
            nome_classe TEXT,
            PRIMARY KEY (tipo_item, codigo_classe)
        );
    """,
    "fato_contratacoes": """
        CREATE TABLE IF NOT EXISTS fato_contratacoes (
            id_compra VARCHAR(100) PRIMARY KEY,
            numero_controle_pncp VARCHAR(100),
            ano_compra INTEGER,
            mes_publicacao VARCHAR(7),
            codigo_orgao INTEGER,
            orgao_cnpj VARCHAR(20),
            orgao_razao_social TEXT,
            orgao_esfera VARCHAR(50),
            orgao_poder VARCHAR(50),
            codigo_uasg VARCHAR(10),
            nome_uasg TEXT,
            uf VARCHAR(2),
            municipio TEXT,
            codigo_ibge INTEGER,
            codigo_modalidade INTEGER,
            modalidade_nome TEXT,
            tipo_contratacao VARCHAR(50),
            modo_disputa_nome VARCHAR(100),
            amparo_legal_codigo INTEGER,
            amparo_legal_nome TEXT,
            amparo_legal_descricao TEXT,
            srp INTEGER DEFAULT 0,
            orcamento_sigiloso_descricao TEXT,
            flag_orcamento_sigiloso INTEGER DEFAULT 0,
            situacao_compra_nome VARCHAR(100),
            objeto_compra TEXT,
            valor_total_estimado DOUBLE PRECISION,
            valor_total_homologado DOUBLE PRECISION,
            economia_reais DOUBLE PRECISION,
            economia_percentual DOUBLE PRECISION,
            teto_dispensa_ano DOUBLE PRECISION,
            pct_limite_dispensa DOUBLE PRECISION,
            data_publicacao_pncp VARCHAR(30),
            data_abertura_proposta VARCHAR(30),
            data_encerramento_proposta VARCHAR(30),
            prazo_dias INTEGER,
            data_inclusao_pncp VARCHAR(30),
            data_atualizacao_pncp VARCHAR(30),
            flag_alterado_apos_publicacao INTEGER DEFAULT 0,
            flag_valor_nulo_ou_zerado INTEGER DEFAULT 0,
            contratacao_excluida INTEGER DEFAULT 0,
            escopo_origem VARCHAR(50)
        );
    """,
    "fato_itens_ti": """
        CREATE TABLE IF NOT EXISTS fato_itens_ti (
            id_compra_item VARCHAR(100) PRIMARY KEY,
            id_compra VARCHAR(100),
            numero_controle_pncp_compra VARCHAR(100),
            ano_inclusao INTEGER,
            mes_inclusao VARCHAR(7),
            codigo_uasg VARCHAR(10),
            orgao_cnpj VARCHAR(20),
            numero_item_compra INTEGER,
            material_ou_servico VARCHAR(2),
            material_ou_servico_nome VARCHAR(50),
            codigo_grupo INTEGER,
            codigo_classe INTEGER,
            cod_item_catalogo INTEGER,
            codigo_pdm INTEGER,
            nome_pdm TEXT,
            descricao_resumida TEXT,
            descricao_detalhada TEXT,
            validado_palavra_chave_ti INTEGER DEFAULT 0,
            unidade_medida VARCHAR(50),
            orcamento_sigiloso INTEGER DEFAULT 0,
            item_categoria_nome VARCHAR(100),
            criterio_julgamento_nome VARCHAR(100),
            situacao_compra_item_nome VARCHAR(100),
            flag_fracasso_deserto_cancelado INTEGER DEFAULT 0,
            tipo_beneficio_nome VARCHAR(100),
            quantidade DOUBLE PRECISION,
            valor_unitario_estimado DOUBLE PRECISION,
            valor_total DOUBLE PRECISION,
            tem_resultado INTEGER DEFAULT 0,
            cod_fornecedor VARCHAR(50),
            nome_fornecedor TEXT,
            quantidade_resultado DOUBLE PRECISION,
            valor_unitario_resultado DOUBLE PRECISION,
            valor_total_resultado DOUBLE PRECISION,
            data_inclusao_pncp VARCHAR(30),
            data_atualizacao_pncp VARCHAR(30),
            flag_item_alterado INTEGER DEFAULT 0,
            flag_erro_cadastro INTEGER DEFAULT 0
        );
    """,
    "fato_resultados_ti": """
        CREATE TABLE IF NOT EXISTS fato_resultados_ti (
            id_compra_item VARCHAR(100),
            sequencial_resultado INTEGER,
            id_compra VARCHAR(100),
            codigo_uasg VARCHAR(10),
            uf_uasg VARCHAR(2),
            orgao_cnpj VARCHAR(20),
            ni_fornecedor VARCHAR(30),
            tipo_pessoa VARCHAR(20),
            nome_razao_social_fornecedor TEXT,
            porte_fornecedor_id INTEGER,
            porte_fornecedor_nome VARCHAR(50),
            flag_me_epp INTEGER DEFAULT 0,
            natureza_juridica_id VARCHAR(20),
            natureza_juridica_nome TEXT,
            quantidade_homologada DOUBLE PRECISION,
            valor_unitario_homologado DOUBLE PRECISION,
            valor_total_homologado DOUBLE PRECISION,
            percentual_desconto DOUBLE PRECISION,
            situacao_resultado_nome VARCHAR(100),
            motivo_cancelamento TEXT,
            flag_cancelado_sem_motivo INTEGER DEFAULT 0,
            aplicacao_beneficio_meepp INTEGER DEFAULT 0,
            aplicacao_margem_preferencia INTEGER DEFAULT 0,
            data_resultado_pncp VARCHAR(30),
            data_inclusao_pncp VARCHAR(30),
            data_atualizacao_pncp VARCHAR(30),
            PRIMARY KEY (id_compra_item, sequencial_resultado)
        );
    """,
    "fato_pca_to": """
        CREATE TABLE IF NOT EXISTS fato_pca_to (
            id_pca_key VARCHAR(150) PRIMARY KEY,
            ano_pca INTEGER,
            orgao VARCHAR(50),
            sigla_instituicao VARCHAR(20),
            codigo_uasg VARCHAR(10),
            nome_uasg TEXT,
            numero_artefato INTEGER,
            ordem_dfd INTEGER,
            descricao_objeto_dfd TEXT,
            nivel_prioridade_dfd INTEGER,
            data_prevista_formalizacao VARCHAR(30),
            tipo_item VARCHAR(50),
            item_sustentavel INTEGER DEFAULT 0,
            codigo_grupo_material INTEGER,
            nome_grupo_material TEXT,
            codigo_classe_material INTEGER,
            nome_classe_material TEXT,
            codigo_grupo_servico INTEGER,
            nome_grupo_servico TEXT,
            codigo_item_catalogo VARCHAR(50),
            descricao_item_catalogo TEXT,
            quantidade_item DOUBLE PRECISION,
            valor_unitario_item DOUBLE PRECISION,
            valor_total_item DOUBLE PRECISION,
            flag_item_ti INTEGER DEFAULT 0,
            data_hora_publicacao_pncp VARCHAR(30)
        );
    """,
    "fato_indicadores_api": """
        CREATE TABLE IF NOT EXISTS fato_indicadores_api (
            ano_mes VARCHAR(10) PRIMARY KEY,
            ano INTEGER,
            mes INTEGER,
            total_servicos INTEGER,
            total_requisicoes BIGINT,
            percentual_sucesso DOUBLE PRECISION,
            media_tempo_resposta_ms DOUBLE PRECISION,
            total_download_gb DOUBLE PRECISION
        );
    """
}

# No SQLite, o tipo REAL e TEXT são nativos
SCHEMAS_SQLITE = {
    tbl: sql.replace("DOUBLE PRECISION", "REAL").replace("BIGINT", "INTEGER")
    for tbl, sql in SCHEMAS_POSTGRES.items()
}


# ============================================================================
# GERENCIAMENTO DE CONEXOES
# ============================================================================
def get_sqlite_connection() -> sqlite3.Connection:
    """Retorna uma conexão ativa com o banco SQLite local com WAL habilitado."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.row_factory = sqlite3.Row
    return conn


def get_neon_connection() -> Optional[Any]:
    """Retorna uma conexão com o Neon PostgreSQL caso DATABASE_URL esteja definida."""
    if not DATABASE_URL:
        return None
    if not PSYCOPG2_AVAILABLE:
        print("    [!] Pacote psycopg2-binary não instalado. Ignorando Neon.")
        return None
    try:
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
        conn.autocommit = False
        return conn
    except Exception as e:
        print(f"    [X] Falha ao conectar ao Neon PostgreSQL: {e}")
        return None


def get_active_connections() -> List[Tuple[str, Any]]:
    """Retorna todas as conexões ativas disponíveis (Neon e SQLite)."""
    conexoes = []
    neon_conn = get_neon_connection()
    if neon_conn:
        conexoes.append(("Neon PostgreSQL", neon_conn))
    
    sqlite_conn = get_sqlite_connection()
    conexoes.append(("SQLite Local", sqlite_conn))
    return conexoes


# ============================================================================
# INSPECAO E INICIALIZACAO IDEMPOTENTE DE TABELAS
# ============================================================================
def table_exists_sqlite(conn: sqlite3.Connection, table_name: str) -> bool:
    cur = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,)
    )
    return cur.fetchone() is not None


def table_exists_postgres(conn: Any, table_name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = %s",
            (table_name,)
        )
        return cur.fetchone() is not None


def init_database() -> Dict[str, Dict[str, str]]:
    """
    Inspeciona se cada tabela existe no Neon PostgreSQL e no SQLite.
    Se existir: notifica que já existe.
    Se não existir: cria e notifica sucesso.
    """
    relatorio = {}
    conexoes = get_active_connections()

    for sgbd_nome, conn in conexoes:
        relatorio[sgbd_nome] = {}
        is_pg = "PostgreSQL" in sgbd_nome
        schemas = SCHEMAS_POSTGRES if is_pg else SCHEMAS_SQLITE

        print(f"\n[*] Inspecionando tabelas no {sgbd_nome}...")
        for tbl in TABLE_NAMES:
            ja_existe = table_exists_postgres(conn, tbl) if is_pg else table_exists_sqlite(conn, tbl)
            if ja_existe:
                status = f"[INFO] A tabela '{tbl}' já existe no {sgbd_nome}. Mantida sem alterações."
                relatorio[sgbd_nome][tbl] = "EXISTENTE"
                print(f"    {status}")
            else:
                ddl = schemas[tbl]
                if is_pg:
                    with conn.cursor() as cur:
                        cur.execute(ddl)
                    conn.commit()
                else:
                    conn.execute(ddl)
                    conn.commit()
                status = f"[SUCESSO] Tabela '{tbl}' criada com sucesso no {sgbd_nome}."
                relatorio[sgbd_nome][tbl] = "CRIADA"
                print(f"    {status}")

        if is_pg:
            conn.close()
        else:
            conn.close()

    return relatorio


# ============================================================================
# LOGICA DE UPSERT INTELIGENTE (INSERT VS UPDATE CONCILIADO)
# ============================================================================
def upsert_records(
    conn: Any,
    table_name: str,
    pk_cols: List[str],
    columns: List[str],
    rows: List[Tuple],
    is_postgres: bool = False
) -> Dict[str, int]:
    """
    Executa UPSERT inteligente:
    - Se a chave não existir: INSERT
    - Se existir: compara data_atualizacao_pncp (se aplicável) e atualiza apenas se for mais recente
    Retorna estatísticas: {'inserted': int, 'updated': int, 'unchanged': int, 'total': len(rows)}
    """
    if not rows:
        return {"inserted": 0, "updated": 0, "unchanged": 0, "total": 0}

    # Gera cláusula ON CONFLICT
    pk_clause = ", ".join(pk_cols)
    non_pk_cols = [c for c in columns if c not in pk_cols]

    if not non_pk_cols:
        # Se todas as colunas forem PKs, ignora em conflito
        conflict_action = "DO NOTHING"
    else:
        # Se a tabela tiver data_atualizacao_pncp, só atualiza se incoming >= existing
        update_set_parts = [f"{c} = EXCLUDED.{c}" for c in non_pk_cols]
        set_clause = ", ".join(update_set_parts)
        if "data_atualizacao_pncp" in non_pk_cols:
            conflict_action = f"DO UPDATE SET {set_clause} WHERE EXCLUDED.data_atualizacao_pncp >= {table_name}.data_atualizacao_pncp"
        else:
            conflict_action = f"DO UPDATE SET {set_clause}"

    ph = "%s" if is_postgres else "?"
    cols_str = ", ".join(columns)
    placeholders = ", ".join([ph] * len(columns))

    sql = f"""
        INSERT INTO {table_name} ({cols_str})
        VALUES ({placeholders})
        ON CONFLICT ({pk_clause}) {conflict_action}
    """

    # Identifica status anterior para contagem precisa de inserções vs atualizações
    # Consulta chaves primárias existentes
    pks_existentes = set()
    try:
        pk_select = ", ".join(pk_cols)
        if is_postgres:
            with conn.cursor() as cur:
                cur.execute(f"SELECT {pk_select} FROM {table_name}")
                pks_existentes = {tuple(str(x) for x in r) if len(pk_cols) > 1 else str(r[0]) for r in cur.fetchall()}
        else:
            cur = conn.execute(f"SELECT {pk_select} FROM {table_name}")
            pks_existentes = {tuple(str(x) for x in r) if len(pk_cols) > 1 else str(r[0]) for r in cur.fetchall()}
    except Exception:
        pass

    pk_indices = [columns.index(pk) for pk in pk_cols]
    novos = 0
    existentes = 0

    for r in rows:
        if len(pk_cols) > 1:
            chave = tuple(str(r[i]) for i in pk_indices)
        else:
            chave = str(r[pk_indices[0]])
        if chave in pks_existentes:
            existentes += 1
        else:
            novos += 1

    # Execução em lote
    if is_postgres:
        with conn.cursor() as cur:
            execute_batch(cur, sql, rows, page_size=500)
        conn.commit()
    else:
        conn.executemany(sql, rows)
        conn.commit()

    return {
        "inserted": novos,
        "updated": existentes,
        "unchanged": 0,
        "total": len(rows)
    }


# ============================================================================
# DIAGNOSTICO DE STATUS DO BANCO
# ============================================================================
def get_db_status() -> Dict[str, Any]:
    """Retorna o diagnóstico de conexão e contagem de registros para cada tabela."""
    status = {}

    # Status Neon PostgreSQL
    if DATABASE_URL and PSYCOPG2_AVAILABLE:
        try:
            conn_pg = psycopg2.connect(DATABASE_URL, connect_timeout=5)
            counts_pg = {}
            with conn_pg.cursor() as cur:
                for tbl in TABLE_NAMES:
                    if table_exists_postgres(conn_pg, tbl):
                        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                        counts_pg[tbl] = cur.fetchone()[0]
                    else:
                        counts_pg[tbl] = "NÃO CRIADA"
            conn_pg.close()
            status["Neon PostgreSQL"] = {"conectado": True, "tabelas": counts_pg}
        except Exception as e:
            status["Neon PostgreSQL"] = {"conectado": False, "erro": str(e)}
    else:
        status["Neon PostgreSQL"] = {
            "conectado": False,
            "motivo": "DATABASE_URL não configurada no .env" if not DATABASE_URL else "psycopg2 ausente"
        }

    # Status SQLite
    try:
        conn_sq = sqlite3.connect(DB_PATH)
        counts_sq = {}
        for tbl in TABLE_NAMES:
            if table_exists_sqlite(conn_sq, tbl):
                cur = conn_sq.execute(f"SELECT COUNT(*) FROM {tbl}")
                counts_sq[tbl] = cur.fetchone()[0]
            else:
                counts_sq[tbl] = "NÃO CRIADA"
        conn_sq.close()
        status["SQLite Local"] = {"conectado": True, "tabelas": counts_sq, "arquivo": str(DB_PATH)}
    except Exception as e:
        status["SQLite Local"] = {"conectado": False, "erro": str(e)}

    return status
