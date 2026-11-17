# Pipeline de Dados e Governança de Compras de TIC (COBIT 5)
> Pesquisa e Análise de Contratações Públicas de TIC (2024–2026) com foco no Tocantins (UFT, IFTO) e Brasil.

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
* `--apenas-to`: Coleta apenas as contratações do Tocantins.
* `--anos 2024 2025`: Filtra apenas determinados anos de interesse.

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
* `config.py`: Parâmetros gerais, tetos legais da Lei 14.133 e regex temática de TI.
