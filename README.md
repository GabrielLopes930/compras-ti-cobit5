# Pipeline de Dados e Governança de Compras de TIC (COBIT 5)
> Pesquisa e Análise de Contratações Públicas de TIC com foco no Tocantins (UFT, IFTO) e Brasil.
> Recorte padrão: **2025** (o mesmo do resumo expandido). Outros anos (2024–2026) podem ser incluídos com `--anos`.

## 🚀 Arquitetura Híbrida e Idempotente

O pipeline opera em **Arquitetura Híbrida**:
1. **Neon Serverless PostgreSQL (Nuvem):** Banco principal quando configurado via `DATABASE_URL` no arquivo `.env`.
2. **SQLite com WAL (Local):** Espelho local automático (`compras_ti_cobit.db`) com integridade transacional garantida contra oscilações de rede.

O sistema é **100% Idempotente**:
* **Criação de Tabelas:** Inspeciona previamente os catálogos do banco (`information_schema.tables` no Postgres e `sqlite_master` no SQLite). Se a tabela já existir, apenas avisa que já está criada e mantém a estrutura.
* **Inserção Inteligente (UPSERT):** Se a tabela estiver vazia, insere todos os registros. Se já existirem dados, compara chaves primárias e timestamps (`data_atualizacao_pncp`), atualizando apenas os registros que sofreram alteração na API e ignorando duplicidades (`DO NOTHING`).

---

## ⚙️ Instalação e Configuração

### 1. Dependências Python
```bash
pip install -r requirements.txt
```

### 2. Configurar o Neon PostgreSQL (Opcional, mas Recomendado)
Crie o arquivo `.env` na raiz copiando de `.env.example`:
```ini
DATABASE_URL=postgresql://neondb_owner:npg_xxxx@ep-exemplo.us-east-2.aws.neon.tech/neondb?sslmode=require
```
*(Se você não configurar o `.env`, o sistema opera automaticamente no SQLite local sem erros).*

### 3. Limite do Neon gratuito (1 GB)
O plano gratuito do Neon permite 1 GB. Para não estourar:
* **Trava automática:** antes de cada gravação o tamanho do banco é conferido. Ao passar de `NEON_LIMITE_MB` (padrão **900 MB**), as gravações seguintes vão só para o SQLite local, e a coleta continua.
* **Descrições cortadas:** textos longos (descrição detalhada do item e do PCA) são limitados a `DESCRICAO_MAX_CHARS` (padrão **400** caracteres).
* **Recorte enxuto:** o padrão é coletar só **2025**. Para incluir mais anos, confira o tamanho antes com `python cli.py status`.

Os dois limites podem ser ajustados no `.env`:
```ini
NEON_LIMITE_MB=900
DESCRICAO_MAX_CHARS=400
```

> A coleta precisa rodar no computador de vocês (com internet direta), porque acessa a API do Compras.gov.br e o Neon.

---

## 🛠️ Comandos da CLI (`cli.py`)

A interface foi estruturada com comandos diretos e intuitivos:

### 1. Inspecionar e Criar as Tabelas
Verifica se as tabelas já existem no Neon e SQLite; se não existirem, cria com as chaves e índices:
```bash
python cli.py init-db
# ou: python cli.py criar-tabelas
```

### 2. Diagnóstico de Conexões e Registros
Exibe o status da conexão com o Neon e a contagem de registros em cada tabela:
```bash
python cli.py status
# ou: python cli.py diagnostico
```

### 3. Mapear o Catálogo de TI (Tarefa T1)
Mapeia automaticamente as 10 classes do Grupo 70 do CATMAT e os 28 grupos da Seção 1 do CATSER (TIC):
```bash
python cli.py t1
# ou: python cli.py catalogo
```

### 4. Coletar e Inserir Dados com Upsert (Tarefa T2 e T3)
Dispara a coleta e faz a conciliação inteligente no banco (insere novos e atualiza alterados):
```bash
python cli.py sync
# ou: python cli.py inserir-dados
```
*Opções adicionais:*
* `--apenas-to`: Coleta apenas as contratações e o PCA do Tocantins.
* `--anos 2024 2025`: Coleta outros anos (padrão: 2025).

**O que é coletado, na ordem:**
1. Contratações do Tocantins (todas as modalidades, mês a mês).
2. PCA (Plano de Contratações Anual) da UFT e do IFTO.
3. Itens de TI do Brasil (classes do grupo 70 do CATMAT e grupos de TIC do CATSER).
4. Compra-pai e resultados (fornecedores) dos itens de TI. Só os resultados de itens de TI são gravados.
5. Indicadores de desempenho da própria API.

**Retomada segura:** se a API falhar ou a internet cair, a janela que falhou **não** é marcada como concluída. Basta rodar o mesmo comando de novo que a coleta continua de onde parou.

### 5. Exportar Cubo Analítico para o Dashboard na Vercel
Lê os dados agregados do banco e gera o arquivo leve `public_data/dashboard_data.json` pronto para alimentar o frontend Next.js:
```bash
python cli.py export-json
# ou: python cli.py exportar
```

---

## 📊 Estrutura de Módulos
* `cli.py`: Ponto de entrada da linha de comando.
* `db.py`: Conexões, DDL, inspeção de esquemas e rotinas de Upsert no Postgres e SQLite.
* `etl.py`: Coleta resiliente da API Dados Abertos Compras.gov.br e checkpoints.
* `export.py`: Queries de agregação (Cubo COBIT 5, Top Fornecedores, Histograma Dispensa Art. 75, II).
* `config.py`: Parâmetros gerais, tetos legais da Lei 14.133, regex temática de TI e limites do Neon.
* `etl_cobit_compras.py`: versão antiga, monolítica, mantida apenas como histórico. **Use o `cli.py`.**
