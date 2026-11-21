# Dashboard Executivo — Governança de Compras de TIC (COBIT 5)

> Módulo web interativo do repositório **`compras-ti-cobit5`** para apresentação executiva (16:9) dos dados abertos do Compras.gov.br (2025 · Esfera Federal · Lei nº 14.133/2021) à luz dos **7 Habilitadores do COBIT 5** e **OKRs de melhoria**.

---

## Organização no Repositório `compras-ti-cobit5`

Este projeto foi estruturado para funcionar diretamente como a subpasta `dashboard/` dentro da raiz do repositório:

```text
compras-ti-cobit5/
├── .env                 # DATABASE_URL compartilhado automaticamente com dashboard/
├── .env.example
├── cli.py / config.py / db.py / etl.py / export.py
├── apresentacao/
├── public_data/
└── dashboard/           # <-- coloque os arquivos deste módulo aqui
    ├── package.json
    ├── server.ts        # Backend Express somente leitura (PostgreSQL + Vite)
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── components/  # Barra de filtros, modal de síntese e 9 visões COBIT 5
        ├── hooks/
        ├── server/      # Pool PostgreSQL read-only, queries SQL e snapshot verificado
        ├── types/
        └── utils/
```

---

## Instalação e Execução

### 1. Instalar dependências (Node.js ≥ 20)

```bash
cd dashboard
npm install
```

### 2. Conexão com o Neon PostgreSQL (`DATABASE_URL`)

O servidor carrega automaticamente a variável `DATABASE_URL` nesta ordem:

1. `dashboard/.env` (caso exista um `.env` local);
2. `../.env` na raiz do repositório `compras-ti-cobit5` (reaproveitando a mesma configuração já usada pelo `cli.py`).

Todas as conexões abrem em modo **estritamente somente leitura** (`default_transaction_read_only=on`, TLS verificado e validação de comandos exclusivamente `SELECT`/`WITH`).

### 3. Executar em desenvolvimento

A partir da pasta `dashboard/`:

```bash
npm run dev
```

Ou diretamente a partir da raiz de `compras-ti-cobit5/`:

```bash
npm --prefix dashboard run dev
```

Acesse `http://localhost:3000`.

### 4. Build e execução em produção

```bash
cd dashboard
npm run build
NODE_ENV=production npm start
```

---

## Visões e Atalhos de Apresentação

- **9 visões navegáveis:** Visão Geral Executiva (`00`), Habilitadores 1 a 7 do COBIT 5 (`01`–`07`) e Plano de Melhoria com OKRs (`08`).
- **Filtros Globais:** Mês de inclusão (2025), Modalidade, Órgão Contratante (com busca) e Tipo de Item (Serviço/Material).
- **Atalhos de teclado:**
  - `Alt + →` / `Alt + ←` — Avançar ou retornar entre as visões.
  - `Alt + D` — Abrir ou fechar o modal de **Síntese e Diagnóstico** da visão atual.

---

## Deploy na Vercel

O projeto já está pronto para a Vercel (`vercel.json` + `scripts/build-vercel.mjs`). O build gera o front-end estático e empacota a API Express (`/api/*`) como uma função serverless.

1. Em **vercel.com → Add New → Project**, importe o repositório `compras-ti-cobit5`.
2. Em **Root Directory**, escolha `dashboard`.
3. Em **Environment Variables**, adicione `DATABASE_URL` com a connection string do Neon.
4. Clique em **Deploy**.

Sem `DATABASE_URL`, o dashboard continua funcionando com o snapshot verificado (`src/server/verifiedSnapshot.json`), mas os filtros não consultam o banco ao vivo.
