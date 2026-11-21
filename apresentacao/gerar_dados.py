#!/usr/bin/env python3
"""
Gera apresentacao/dados.js a partir do banco SQLite local (compras_ti_cobit.db),
que espelha o Neon. O deck (apresentacao/index.html) lê esse arquivo e preenche
os slides de resultados e as linhas de base dos OKRs.

Uso (na raiz do repositório):
    python apresentacao/gerar_dados.py

Pode ser rodado a qualquer momento, inclusive com a coleta pela metade:
o deck mostra a cobertura (meses coletados) de forma explícita.
"""
import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DB = RAIZ / "compras_ti_cobit.db"
SAIDA = Path(__file__).resolve().parent / "dados.js"

if not DB.exists():
    sys.exit(f"Banco não encontrado: {DB}. Rode antes: python cli.py sync")

con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
con.row_factory = sqlite3.Row


def q(sql, params=()):
    return [dict(r) for r in con.execute(sql, params).fetchall()]


def q1(sql, params=()):
    r = con.execute(sql, params).fetchone()
    return dict(r) if r else {}


def pct(a, b):
    return round(a * 100.0 / b, 2) if b else None


# Compras de TI = compras que têm ao menos um item de TI coletado
con.execute("CREATE TEMP VIEW ti_compras AS SELECT DISTINCT id_compra FROM fato_itens_ti WHERE id_compra <> ''")

# ---------------------------------------------------------------- filtros da análise
# 1) Esfera federal: o Compras.gov.br também é usado por estados e municípios.
# 2) Valores implausíveis: itens com valor acima de LIMITE_ITEM (padrão R$ 1 bilhão)
#    ou compras acima de LIMITE_COMPRA (padrão R$ 10 bilhões) são erros de cadastro.
#    Eles ficam fora dos indicadores e entram como achado de qualidade da informação.
LIM_ITEM = float(os.getenv("LIMITE_ITEM", "1e9"))
LIM_COMPRA = float(os.getenv("LIMITE_COMPRA", "1e10"))
esferas = [dict(r) for r in con.execute(
    "SELECT COALESCE(orgao_esfera,'?') AS esfera, COUNT(*) AS n FROM fato_contratacoes GROUP BY 1 ORDER BY n DESC")]
tem_federal = any(str(e["esfera"]).upper().startswith("F") for e in esferas)
filtro_esfera = "UPPER(SUBSTR(COALESCE(orgao_esfera,''),1,1)) = 'F'" if tem_federal else "1=1"
con.execute(f"""CREATE TEMP VIEW contr AS SELECT * FROM fato_contratacoes
                WHERE {filtro_esfera}
                  AND COALESCE(valor_total_estimado,0) <= {LIM_COMPRA}
                  AND COALESCE(valor_total_homologado,0) <= {LIM_COMPRA}""")
con.execute(f"""CREATE TEMP VIEW itens_ok AS SELECT i.* FROM fato_itens_ti i
                JOIN contr c ON c.id_compra = i.id_compra
                WHERE COALESCE(i.valor_total,0) <= {LIM_ITEM}
                  AND COALESCE(i.valor_total_resultado,0) <= {LIM_ITEM}""")

d = {"gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M")}

# ---------------------------------------------------------------- cobertura
cob = q1("""SELECT MIN(mes_inclusao) AS de, MAX(mes_inclusao) AS ate,
                   COUNT(DISTINCT mes_inclusao) AS meses, COUNT(*) AS itens
            FROM fato_itens_ti""")
d["cobertura"] = cob
d["contagens"] = {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in (
    "fato_contratacoes", "fato_itens_ti", "fato_resultados_ti", "fato_pca_to",
    "fato_indicadores_api", "dim_catalogo_ti")}

# Diagnóstico dos filtros (vai para o deck e para o terminal)
_fed_ids = f"SELECT id_compra FROM fato_contratacoes WHERE {filtro_esfera}"
diag = q1(f"""SELECT
    COUNT(*) AS itens_total,
    SUM(CASE WHEN c.id_compra IS NULL THEN 1 ELSE 0 END) AS itens_sem_compra,
    SUM(CASE WHEN c.id_compra IS NOT NULL AND NOT ({filtro_esfera.replace('orgao_esfera','c.orgao_esfera')}) THEN 1 ELSE 0 END) AS itens_outras_esferas,
    SUM(CASE WHEN c.id_compra IS NOT NULL AND ({filtro_esfera.replace('orgao_esfera','c.orgao_esfera')})
              AND (COALESCE(i.valor_total,0) > {LIM_ITEM} OR COALESCE(i.valor_total_resultado,0) > {LIM_ITEM}
                   OR COALESCE(c.valor_total_estimado,0) > {LIM_COMPRA} OR COALESCE(c.valor_total_homologado,0) > {LIM_COMPRA})
             THEN 1 ELSE 0 END) AS itens_implausiveis,
    SUM(CASE WHEN c.id_compra IS NOT NULL AND ({filtro_esfera.replace('orgao_esfera','c.orgao_esfera')})
              AND (COALESCE(i.valor_total,0) > {LIM_ITEM} OR COALESCE(i.valor_total_resultado,0) > {LIM_ITEM}
                   OR COALESCE(c.valor_total_estimado,0) > {LIM_COMPRA} OR COALESCE(c.valor_total_homologado,0) > {LIM_COMPRA})
             THEN COALESCE(i.valor_total,0) ELSE 0 END) AS valor_implausivel
    FROM fato_itens_ti i LEFT JOIN fato_contratacoes c ON c.id_compra = i.id_compra""")
diag["itens_analisados"] = con.execute("SELECT COUNT(*) FROM itens_ok").fetchone()[0]
diag["esferas"] = esferas
diag["filtro_federal"] = tem_federal
diag["limite_item"] = LIM_ITEM
diag["limite_compra"] = LIM_COMPRA
d["filtros"] = diag

# ---------------------------------------------------------------- visão geral TI
g = q1("""SELECT COUNT(DISTINCT id_compra) AS contratacoes, COUNT(*) AS itens,
                 SUM(COALESCE(valor_total,0)) AS valor_estimado,
                 SUM(CASE WHEN tem_resultado=1 THEN COALESCE(valor_total_resultado,0) ELSE 0 END) AS valor_homologado,
                 SUM(CASE WHEN tem_resultado=1 AND valor_total>0 AND valor_total_resultado>0 AND valor_total_resultado BETWEEN valor_total*0.01 AND valor_total*2 THEN valor_total ELSE 0 END) AS est_com_resultado,
                 SUM(CASE WHEN tem_resultado=1 AND valor_total>0 AND valor_total_resultado>0 AND valor_total_resultado BETWEEN valor_total*0.01 AND valor_total*2 THEN valor_total_resultado ELSE 0 END) AS hom_com_resultado,
                 AVG(flag_fracasso_deserto_cancelado) * 100 AS pct_fracasso,
                 AVG(flag_erro_cadastro) * 100 AS pct_erro_cadastro,
                 AVG(validado_palavra_chave_ti) * 100 AS pct_validado_palavra
          FROM itens_ok""")
g["economia_pct"] = pct((g["est_com_resultado"] or 0) - (g["hom_com_resultado"] or 0), g["est_com_resultado"] or 0)
d["geral"] = g

d["serie_mensal"] = q("""SELECT mes_inclusao AS mes, COUNT(*) AS itens, SUM(COALESCE(valor_total,0)) AS valor
                         FROM itens_ok GROUP BY 1 ORDER BY 1""")

d["material_servico"] = q("""SELECT COALESCE(material_ou_servico_nome, material_ou_servico) AS tipo,
                                    COUNT(*) AS itens, SUM(COALESCE(valor_total,0)) AS valor
                             FROM itens_ok GROUP BY 1 ORDER BY valor DESC""")

# ---------------------------------------------------------------- competição (TI)
mod = q("""SELECT COALESCE(c.modalidade_nome,'Não identificada') AS modalidade,
                  COALESCE(c.tipo_contratacao,'Não identificada') AS tipo,
                  COUNT(DISTINCT i.id_compra) AS contratacoes,
                  SUM(COALESCE(i.valor_total,0)) AS valor,
                  SUM(CASE WHEN i.tem_resultado=1 AND i.valor_total>0 AND i.valor_total_resultado>0 AND i.valor_total_resultado BETWEEN i.valor_total*0.01 AND i.valor_total*2 THEN i.valor_total ELSE 0 END) AS est_r,
                  SUM(CASE WHEN i.tem_resultado=1 AND i.valor_total>0 AND i.valor_total_resultado>0 AND i.valor_total_resultado BETWEEN i.valor_total*0.01 AND i.valor_total*2 THEN i.valor_total_resultado ELSE 0 END) AS hom_r
           FROM itens_ok i LEFT JOIN contr c ON c.id_compra = i.id_compra
           GROUP BY 1,2 ORDER BY valor DESC""")
for m in mod:
    m["economia_pct"] = pct(m["est_r"] - m["hom_r"], m["est_r"])
d["modalidades_ti"] = mod
tot_v = sum(m["valor"] or 0 for m in mod)
tot_c = sum(m["contratacoes"] or 0 for m in mod)
dir_v = sum(m["valor"] or 0 for m in mod if m["tipo"] == "Contratação Direta")
dir_c = sum(m["contratacoes"] or 0 for m in mod if m["tipo"] == "Contratação Direta")
d["direta"] = {"pct_valor": pct(dir_v, tot_v), "pct_qtd": pct(dir_c, tot_c)}

# ---------------------------------------------------------------- fornecedores (TI)
n_res = con.execute("SELECT COUNT(*) FROM fato_resultados_ti").fetchone()[0]
n_itens_res = con.execute("SELECT COUNT(*) FROM itens_ok WHERE tem_resultado = 1").fetchone()[0]
usar_resultados = n_itens_res and n_res >= 0.5 * n_itens_res
if usar_resultados:
    # Resultados homologados (trazem o porte do fornecedor)
    forn = q("""SELECT ni_fornecedor, MAX(nome_razao_social_fornecedor) AS fornecedor,
                       MAX(porte_fornecedor_nome) AS porte, MAX(flag_me_epp) AS me_epp,
                       SUM(COALESCE(valor_total_homologado,0)) AS valor, COUNT(*) AS itens
                FROM fato_resultados_ti GROUP BY ni_fornecedor ORDER BY valor DESC""")
    desconto = q1("SELECT AVG(percentual_desconto) AS v FROM fato_resultados_ti WHERE percentual_desconto IS NOT NULL").get("v")
else:
    # Fornecedor vencedor informado no próprio item (sem porte)
    forn = q("""SELECT cod_fornecedor AS ni_fornecedor, MAX(nome_fornecedor) AS fornecedor,
                       NULL AS porte, NULL AS me_epp,
                       SUM(COALESCE(valor_total_resultado,0)) AS valor, COUNT(*) AS itens
                FROM itens_ok
                WHERE tem_resultado = 1 AND COALESCE(cod_fornecedor,'') <> ''
                GROUP BY cod_fornecedor ORDER BY valor DESC""")
    desconto = q1("""SELECT AVG((valor_total - valor_total_resultado) * 100.0 / valor_total) AS v
                     FROM itens_ok WHERE tem_resultado = 1 AND valor_total > 0
                       AND valor_total_resultado > 0 AND valor_total_resultado <= valor_total""").get("v")
tot_f = sum(f["valor"] or 0 for f in forn)
d["fornecedores"] = {
    "fonte": "resultados" if usar_resultados else "itens",
    "distintos": len(forn),
    "top10": [{k: f[k] for k in ("fornecedor", "porte", "valor", "itens")} for f in forn[:10]],
    "pct_top10": pct(sum(f["valor"] or 0 for f in forn[:10]), tot_f),
    "pct_me_epp_valor": pct(sum(f["valor"] or 0 for f in forn if f["me_epp"]), tot_f) if usar_resultados else None,
    "valor_total": tot_f,
    "desconto_medio": desconto,
}

# ---------------------------------------------------------------- Tocantins
to = q1("""SELECT COUNT(*) AS contratacoes, SUM(COALESCE(valor_total_estimado,0)) AS valor_estimado,
                  SUM(CASE WHEN tipo_contratacao='Contratação Direta' THEN 1 ELSE 0 END) AS diretas,
                  SUM(CASE WHEN valor_total_estimado>0 AND valor_total_homologado>0 AND valor_total_homologado BETWEEN valor_total_estimado*0.01 AND valor_total_estimado*2 THEN valor_total_estimado ELSE 0 END) AS est_r,
                  SUM(CASE WHEN valor_total_estimado>0 AND valor_total_homologado>0 AND valor_total_homologado BETWEEN valor_total_estimado*0.01 AND valor_total_estimado*2 THEN valor_total_homologado ELSE 0 END) AS hom_r
           FROM contr WHERE uf='TO'""")
to["pct_direta_qtd"] = pct(to["diretas"] or 0, to["contratacoes"] or 0)
to["economia_pct"] = pct((to["est_r"] or 0) - (to["hom_r"] or 0), to["est_r"] or 0)
to["com_ti"] = q1("SELECT COUNT(*) AS n FROM contr WHERE uf='TO' AND id_compra IN (SELECT id_compra FROM ti_compras)")["n"]
to["orgaos"] = q("""SELECT COALESCE(orgao_razao_social,'Não informado') AS orgao, COUNT(*) AS contratacoes,
                           SUM(CASE WHEN tipo_contratacao='Contratação Direta' THEN 1 ELSE 0 END) AS diretas
                    FROM contr WHERE uf='TO' GROUP BY 1 ORDER BY contratacoes DESC LIMIT 6""")
d["tocantins"] = to

d["pca"] = q("""SELECT sigla_instituicao AS instituicao, ano_pca AS ano, COUNT(*) AS itens,
                       SUM(COALESCE(valor_total_item,0)) AS valor,
                       SUM(flag_item_ti) AS itens_ti,
                       SUM(CASE WHEN flag_item_ti=1 THEN COALESCE(valor_total_item,0) ELSE 0 END) AS valor_ti
                FROM fato_pca_to GROUP BY 1,2 ORDER BY 1,2""")

# ---------------------------------------------------------------- fracionamento (dispensas)
d["dispensa"] = q("""SELECT CASE
        WHEN pct_limite_dispensa < 20 THEN '0–20%'
        WHEN pct_limite_dispensa < 40 THEN '20–40%'
        WHEN pct_limite_dispensa < 60 THEN '40–60%'
        WHEN pct_limite_dispensa < 80 THEN '60–80%'
        WHEN pct_limite_dispensa < 90 THEN '80–90%'
        WHEN pct_limite_dispensa <= 100 THEN '90–100%'
        ELSE 'Acima do teto' END AS faixa, COUNT(*) AS qtd
    FROM contr
    WHERE LOWER(modalidade_nome) LIKE '%dispensa%' AND valor_total_estimado > 0 AND pct_limite_dispensa IS NOT NULL
    GROUP BY 1""")

# ---------------------------------------------------------------- qualidade da informação
qc = q1("""SELECT COUNT(*) AS n, AVG(flag_orcamento_sigiloso)*100 AS pct_sigiloso,
                  AVG(flag_alterado_apos_publicacao)*100 AS pct_alterado,
                  AVG(flag_valor_nulo_ou_zerado)*100 AS pct_valor_nulo
           FROM fato_contratacoes WHERE """ + filtro_esfera + """""")
qr = q1("""SELECT AVG(flag_cancelado_sem_motivo)*100 AS pct_cancel_sem_motivo FROM fato_resultados_ti""") if n_res else {}
qi = q1("""SELECT AVG(flag_item_alterado)*100 AS pct_item_alterado FROM fato_itens_ti""")
d["qualidade"] = {**qc, **qr, **qi, "pct_erro_cadastro": g["pct_erro_cadastro"]}

api = q1("""SELECT COUNT(*) AS meses, AVG(percentual_sucesso) AS sucesso_medio,
                   MIN(percentual_sucesso) AS sucesso_min, AVG(media_tempo_resposta_ms) AS tempo_medio_ms,
                   SUM(total_requisicoes) AS requisicoes
            FROM fato_indicadores_api""")
d["api"] = api
d["api_mensal"] = q("SELECT ano_mes, percentual_sucesso, media_tempo_resposta_ms FROM fato_indicadores_api ORDER BY ano_mes")

con.close()
SAIDA.write_text("window.DADOS = " + json.dumps(d, ensure_ascii=False, default=float) + ";\n", encoding="utf-8")
print(f"[OK] {SAIDA} gerado ({SAIDA.stat().st_size/1024:.1f} KB)")
print(f"     Cobertura: {cob.get('meses') or 0} mês(es) de itens de TI "
      f"({cob.get('de') or '-'} a {cob.get('ate') or '-'}), {cob.get('itens') or 0} itens.")
print(f"     Esferas nas contratações: {', '.join(str(e['esfera']) + '=' + str(e['n']) for e in esferas)}"
      f"  -> filtro federal: {'SIM' if tem_federal else 'NÃO (esfera F não encontrada)'}")
print(f"     Itens analisados: {diag['itens_analisados']} de {diag['itens_total']} "
      f"(sem compra-pai: {diag['itens_sem_compra']}, outras esferas: {diag['itens_outras_esferas']}, "
      f"valores implausíveis: {diag['itens_implausiveis']} somando R$ {(diag['valor_implausivel'] or 0)/1e12:.2f} tri)")
print(f"     Valor estimado analisado: R$ {(d['geral'].get('valor_estimado') or 0)/1e9:.2f} bi · "
      f"economia {d['geral'].get('economia_pct')}% · sem competição (valor) {d['direta'].get('pct_valor')}%")
