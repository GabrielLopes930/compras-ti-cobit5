import argparse
import sys
from typing import List

import db
import etl
import export


def cmd_init_db(args):
    """Verifica e inicializa as tabelas no Neon PostgreSQL e SQLite."""
    print("=" * 70)
    print("  COBIT 5 - INICIALIZACAO IDEMPOTENTE DO BANCO DE DADOS")
    print("=" * 70)
    db.init_database()
    print("\n[✔] Verificação e inicialização de tabelas concluída com sucesso.")


def cmd_status(args):
    """Exibe o diagnóstico de conexões e contagem de registros em cada tabela."""
    print("=" * 70)
    print("  COBIT 5 - DIAGNOSTICO E STATUS DOS BANCOS DE DADOS")
    print("=" * 70)
    st = db.get_db_status()

    # Neon PostgreSQL
    neon = st.get("Neon PostgreSQL", {})
    print("\n[+] NEON POSTGRESQL:")
    if neon.get("conectado"):
        print("    Status: CONECTADO")
        tabelas = neon.get("tabelas", {})
        for t, qtd in tabelas.items():
            print(f"    - {t.ljust(22)}: {qtd} registros")
    else:
        print(f"    Status: NAO CONECTADO ({neon.get('motivo') or neon.get('erro')})")

    # SQLite Local
    sq = st.get("SQLite Local", {})
    print("\n[+] SQLITE LOCAL:")
    if sq.get("conectado"):
        print(f"    Arquivo: {sq.get('arquivo')}")
        tabelas = sq.get("tabelas", {})
        for t, qtd in tabelas.items():
            print(f"    - {t.ljust(22)}: {qtd} registros")
    else:
        print(f"    Status: FALHA ({sq.get('erro')})")
    print("\n" + "=" * 70)


def cmd_t1(args):
    """Executa a Tarefa T1: mapeamento do CATMAT Grupo 70 e CATSER TIC."""
    print("=" * 70)
    print("  COBIT 5 - TAREFA T1: CATALOGO DE TIC (CATMAT & CATSER)")
    print("=" * 70)
    etl.executar_t1_catalogo()


def cmd_collect(args):
    """Executa a coleta da API (Contratações TO, Itens de TI Nacionais, KPIs)."""
    print("=" * 70)
    print("  COBIT 5 - TAREFA T2: COLETA DE DADOS COM CHECKPOINT")
    print("=" * 70)
    anos = [int(a) for a in args.anos] if args.anos else [2024, 2025, 2026]
    apenas_to = bool(args.apenas_to)
    etl.executar_t2_coleta(anos=anos, apenas_to=apenas_to)


def cmd_sync(args):
    """Executa a carga inteligente com Upsert (T1 + Coleta incremental)."""
    print("=" * 70)
    print("  COBIT 5 - SINCRONIZACAO INTELIGENTE (UPSERT)")
    print("=" * 70)
    # 1. Garante que as tabelas existem
    db.init_database()
    # 2. Sincroniza catálogo T1
    classes_mat, grupos_serv = etl.executar_t1_catalogo()
    # 3. Sincroniza dados T2
    anos = [int(a) for a in args.anos] if args.anos else [2024, 2025, 2026]
    etl.executar_t2_coleta(anos=anos, classes_mat=classes_mat, grupos_serv=grupos_serv, apenas_to=bool(args.apenas_to))
    # 4. Exporta JSON atualizado
    export.exportar_dashboard_json()


def cmd_export(args):
    """Gera o arquivo public_data/dashboard_data.json."""
    print("=" * 70)
    print("  COBIT 5 - EXPORTACAO PARA VERCEL (JSON)")
    print("=" * 70)
    export.exportar_dashboard_json()


def main():
    parser = argparse.ArgumentParser(
        prog="python cli.py",
        description="CLI do Pipeline de Dados de Compras de TI (COBIT 5) - Neon PostgreSQL & SQLite"
    )

    subparsers = parser.add_subparsers(dest="command", help="Comandos disponíveis")

    # init-db
    p_init = subparsers.add_parser("init-db", aliases=["criar-tabelas", "criar-banco"], help="Inspeciona e cria tabelas no Neon e SQLite")
    p_init.set_defaults(func=cmd_init_db)

    # status
    p_status = subparsers.add_parser("status", aliases=["diagnostico"], help="Diagnóstico de conexões e contagem de registros")
    p_status.set_defaults(func=cmd_status)

    # t1
    p_t1 = subparsers.add_parser("t1", aliases=["catalogo"], help="Executa o mapeamento de classes CATMAT 70 e grupos CATSER TIC")
    p_t1.set_defaults(func=cmd_t1)

    # collect
    p_collect = subparsers.add_parser("collect", aliases=["coletar"], help="Executa a coleta de dados da API")
    p_collect.add_argument("--anos", nargs="+", default=["2024", "2025", "2026"], help="Anos para coleta (ex: --anos 2024 2025)")
    p_collect.add_argument("--apenas-to", action="store_true", help="Coleta apenas contratações do Tocantins")
    p_collect.set_defaults(func=cmd_collect)

    # sync / inserir-dados
    p_sync = subparsers.add_parser("sync", aliases=["inserir-dados", "carregar"], help="Executa inserção e upsert conciliado no Neon e SQLite")
    p_sync.add_argument("--anos", nargs="+", default=["2024", "2025", "2026"], help="Anos para coleta")
    p_sync.add_argument("--apenas-to", action="store_true", help="Coleta apenas compras do Tocantins")
    p_sync.set_defaults(func=cmd_sync)

    # export-json
    p_export = subparsers.add_parser("export-json", aliases=["exportar"], help="Gera o JSON analítico para o frontend na Vercel")
    p_export.set_defaults(func=cmd_export)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
