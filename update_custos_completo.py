#!/usr/bin/env python3
"""
Atualização completa de custos e markups a partir da planilha.
- Extrai SKU limpo da coluna A (antes do " - ")
- Agrupa por SKU único (mesmo custo para todas as linhas do mesmo SKU)
- Usa match direto + troca de prefixo L→A e A→L
- Prioridade: match direto > troca de prefixo
- Não sobrescreve com match por sufixo quando match direto já existe
"""
import json, re, gc
import mysql.connector
import openpyxl

# ─── Conexão banco ────────────────────────────────────────────────────────────
with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()
conn = mysql.connector.connect(host=host, port=int(port), user=user, password=password, database=dbname, ssl_disabled=False)
cursor = conn.cursor(dictionary=True)

cursor.execute("SELECT id, sku FROM products")
all_products = cursor.fetchall()

# Indexar por SKU upper
db_by_sku = {}
for p in all_products:
    if p['sku']:
        db_by_sku[p['sku'].upper().strip()] = p
del all_products
gc.collect()

# ─── Prefixos equivalentes ────────────────────────────────────────────────────
PREFIX_ALTS = {
    'LLE': ['ALE'], 'ALE': ['LLE'],
    'LLS': ['ALS'], 'ALS': ['LLS'],
    'LLP': ['ALP'], 'ALP': ['LLP'],
    'LDE': ['ADE'], 'ADE': ['LDE'],
    'LDS': ['ADS'], 'ADS': ['LDS'],
    'LDP': ['ADP'], 'ADP': ['LDP'],
    'LDA': ['ADA'], 'ADA': ['LDA'],
    'LDB': ['ADB'], 'ADB': ['LDB'],
    'LDC': ['ADC'], 'ADC': ['LDC'],
    'LFE': ['AFE'], 'AFE': ['LFE'],
    'LFS': ['AFS'], 'AFS': ['LFS'],
}

def extract_sku(col_a_val):
    """Extrai SKU limpo da coluna A. Ex: 'LDB-7474.FW1.58F - MOON FW...' → 'LDB-7474.FW1.58F'"""
    s = str(col_a_val).strip()
    if ' - ' in s:
        s = s.split(' - ')[0].strip()
    return s.upper()

def try_match(sku):
    """Tenta encontrar produto no banco. Retorna (id, metodo) ou (None, None)."""
    # 1. Match direto
    if sku in db_by_sku:
        return db_by_sku[sku]['id'], 'direto'
    # 2. Troca de prefixo
    prefix = sku[:3]
    suffix = sku[3:]
    for alt in PREFIX_ALTS.get(prefix, []):
        alt_sku = alt + suffix
        if alt_sku in db_by_sku:
            return db_by_sku[alt_sku]['id'], f'{prefix}→{alt}'
    return None, None

# ─── Ler planilha e agrupar por SKU ──────────────────────────────────────────
# Estrutura: { sku: { 'custo': float, 'mkp_padrao': float, 'mkp_minimo': float,
#                     'drivers': set(), 'row_first': int } }
print("Lendo planilha...")
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

sku_data = {}  # SKU_LIMPO → dados

for row in ws.iter_rows(min_row=2, values_only=True):
    col_a = row[0]  # Descrição/SKU
    col_b = row[1]  # Custo
    col_c = row[2]  # MKP Padrão
    col_d = row[3]  # MKP Mínimo
    col_g = row[6] if len(row) > 6 else None  # Tipo driver

    if col_a is None or col_b is None:
        continue

    try:
        custo = float(col_b)
    except:
        continue

    if custo <= 0:
        continue

    sku = extract_sku(col_a)
    if not sku or sku == 'DESCRIÇÃO DO PRODUTO':
        continue

    mkp_padrao = None
    mkp_minimo = None
    try:
        if col_c is not None:
            mkp_padrao = float(col_c)
    except:
        pass
    try:
        if col_d is not None:
            mkp_minimo = float(col_d)
    except:
        pass

    driver_tipo = str(col_g).upper().strip() if col_g else ''

    if sku not in sku_data:
        sku_data[sku] = {
            'custo': custo,
            'mkp_padrao': mkp_padrao,
            'mkp_minimo': mkp_minimo,
            'drivers': set(),
        }
    else:
        # Usar o primeiro custo encontrado (são iguais para o mesmo SKU)
        pass

    if driver_tipo:
        sku_data[sku]['drivers'].add(driver_tipo)

wb.close()
del wb
gc.collect()

print(f"SKUs únicos na planilha com custo: {len(sku_data)}")

# ─── Mapear SKUs para IDs do banco ───────────────────────────────────────────
mapeamentos = []  # (id_banco, sku_planilha, sku_banco, metodo, dados)
nao_encontrados = []

# Primeiro, coletar todos os matches diretos
diretos = set()
for sku_plan, dados in sku_data.items():
    prod_id, metodo = try_match(sku_plan)
    if prod_id:
        if metodo == 'direto':
            diretos.add(prod_id)
        mapeamentos.append((prod_id, sku_plan, metodo, dados))
    else:
        nao_encontrados.append(sku_plan)

# Remover duplicatas: se um produto tem match direto E por prefixo, manter só o direto
seen_ids = {}
for prod_id, sku_plan, metodo, dados in mapeamentos:
    if prod_id not in seen_ids:
        seen_ids[prod_id] = (sku_plan, metodo, dados)
    else:
        # Priorizar match direto
        _, metodo_existente, _ = seen_ids[prod_id]
        if metodo == 'direto' and metodo_existente != 'direto':
            seen_ids[prod_id] = (sku_plan, metodo, dados)

print(f"Produtos encontrados no banco: {len(seen_ids)}")
print(f"SKUs não encontrados: {len(nao_encontrados)}")

# ─── Determinar campos a atualizar por tipo de driver ────────────────────────
def get_driver_fields(drivers, custo, mkp_padrao, mkp_minimo):
    """Retorna dict com campos a atualizar baseado nos tipos de driver."""
    update = {}
    
    # Normalizar drivers
    drivers_norm = set()
    for d in drivers:
        d_up = d.upper()
        if 'ON' in d_up and 'OFF' in d_up:
            drivers_norm.add('ONOFF')
        elif 'DIM' in d_up and 'DALI' in d_up:
            drivers_norm.add('DIMDALI')
        elif 'DIM' in d_up and 'TRIAC' in d_up and '110' in d_up:
            drivers_norm.add('DIMTRIAC110V')
        elif 'DIM' in d_up and 'TRIAC' in d_up and '220' in d_up:
            drivers_norm.add('DIMTRIAC220V')
        elif 'DIM' in d_up and ('1-10' in d_up or '110' in d_up or '1/10' in d_up):
            drivers_norm.add('DIM110V')
        elif 'DIM' in d_up:
            drivers_norm.add('DIM110V')
    
    # Se não identificou nenhum driver específico, aplicar em todos
    if not drivers_norm:
        drivers_norm = {'ONOFF', 'DIMDALI', 'DIM110V', 'DIMTRIAC110V', 'DIMTRIAC220V'}
    
    custo_str = str(round(custo, 4))
    mkp_p_str = str(round(mkp_padrao, 4)) if mkp_padrao else None
    mkp_m_str = str(round(mkp_minimo, 4)) if mkp_minimo else None
    
    for drv in drivers_norm:
        if drv == 'ONOFF':
            update['custoCorpoOnoff220v'] = custo_str
            update['custoCorpoOnoffBivolt'] = custo_str
            if mkp_p_str:
                update['mkpPadraoOnoff220v'] = mkp_p_str
                update['mkpPadraoOnoffBivolt'] = mkp_p_str
            if mkp_m_str:
                update['mkpMinimoOnoff220v'] = mkp_m_str
                update['mkpMinimoOnoffBivolt'] = mkp_m_str
        elif drv == 'DIM110V':
            update['custoCorpoDim110v'] = custo_str
            if mkp_p_str:
                update['mkpPadraoDim110v'] = mkp_p_str
            if mkp_m_str:
                update['mkpMinimoDim110v'] = mkp_m_str
        elif drv == 'DIMDALI':
            update['custoCorpoDimDali'] = custo_str
            if mkp_p_str:
                update['mkpPadraoDimDali'] = mkp_p_str
            if mkp_m_str:
                update['mkpMinimoDimDali'] = mkp_m_str
        elif drv == 'DIMTRIAC110V':
            update['custoCorpoDimTriac110v'] = custo_str
            if mkp_p_str:
                update['mkpPadraoDimTriac110v'] = mkp_p_str
            if mkp_m_str:
                update['mkpMinimoDimTriac110v'] = mkp_m_str
        elif drv == 'DIMTRIAC220V':
            update['custoCorpoDimTriac220v'] = custo_str
            if mkp_p_str:
                update['mkpPadraoDimTriac220v'] = mkp_p_str
            if mkp_m_str:
                update['mkpMinimoDimTriac220v'] = mkp_m_str
    
    return update

# ─── Executar atualizações ────────────────────────────────────────────────────
print("\nAtualizando banco de dados...")
atualizados = 0
erros = 0

for prod_id, (sku_plan, metodo, dados) in seen_ids.items():
    fields = get_driver_fields(
        dados['drivers'],
        dados['custo'],
        dados['mkp_padrao'],
        dados['mkp_minimo']
    )
    
    if not fields:
        continue
    
    set_clause = ', '.join([f"`{k}` = %s" for k in fields.keys()])
    values = list(fields.values()) + [prod_id]
    
    try:
        cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s", values)
        atualizados += 1
    except Exception as e:
        print(f"  ERRO ao atualizar id={prod_id} ({sku_plan}): {e}")
        erros += 1

conn.commit()
conn.close()

print(f"\n{'='*60}")
print(f"RESULTADO:")
print(f"  Produtos atualizados: {atualizados}")
print(f"  Erros: {erros}")
print(f"  SKUs não encontrados no banco: {len(nao_encontrados)}")
print(f"{'='*60}")

if nao_encontrados:
    print(f"\n=== {len(nao_encontrados)} SKUs da planilha NÃO encontrados no banco ===")
    for sku in sorted(nao_encontrados):
        print(f"  {sku}")
