import os
import re
from pathlib import Path
from dotenv import load_dotenv

# Carrega arquivo .env se presente
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# ============================================================================
# DIRETORIOS E CAMINHOS
# ============================================================================
DB_PATH = BASE_DIR / "compras_ti_cobit.db"
PUBLIC_DATA_DIR = BASE_DIR / "public_data"
PUBLIC_DATA_DIR.mkdir(exist_ok=True)

# Conexão Neon PostgreSQL (opcional via variável de ambiente)
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# ============================================================================
# CONFIGURACOES DA API COMPRAS.GOV.BR
# ============================================================================
BASE_URL = "https://dadosabertos.compras.gov.br"
USER_AGENT = "COBIT5-Research-ULBRA-Palmas/1.0"

ANOS_ESCOPO = [2024, 2025, 2026]

# Recorte padrão da coleta: 2025, o mesmo do resumo expandido.
# Outros anos podem ser incluídos com --anos, desde que caibam no limite do Neon.
ANOS_PADRAO = [2025]

# ============================================================================
# LIMITE DO NEON (PLANO GRATUITO = 1 GB)
# ============================================================================
# Antes de cada gravação no Neon, o tamanho do banco é conferido. Ao passar deste
# limite, a gravação no Neon é interrompida (o SQLite local continua recebendo).
NEON_LIMITE_MB = int(os.getenv("NEON_LIMITE_MB", "900"))

# Descrições longas são cortadas para economizar espaço no Neon.
DESCRICAO_MAX_CHARS = int(os.getenv("DESCRICAO_MAX_CHARS", "400"))

# Tetos legais de Dispensa de Licitação (Art. 75, II da Lei 14.133/2021)
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

# Órgãos federais do Tocantins para análise de PCA (UFT e IFTO)
ORGAOS_PCA_TO = {
    "26251": "UFT",   # Fundação Universidade Federal do Tocantins
    "26424": "IFTO",  # Instituto Federal do Tocantins
}

# Expressão regular para validação temática de TI
REGEX_PALAVRAS_TI = re.compile(
    r"\b(software|licen[cç]a|computador|notebook|laptop|servidor|storage|"
    r"switch|roteador|firewall|nuvem|cloud|saas|iaas|paas|fibra [oó]ptica|"
    r"inform[aá]tica|processamento de dados|banco de dados|sistema web|"
    r"desenvolvimento de sistema|suporte t[eé]cnico|help\s?desk|service\s?desk|"
    r"ciberseguran[cç]a|antiv[ií]rus|backup|datacenter|data center|rede l[oó]gica|"
    r"monitor led|impressora|scanner|nobreak|ups|token|certificado digital)\b",
    re.IGNORECASE,
)
