#!/usr/bin/env python3
"""
Atualização por família: para SKUs da planilha não encontrados diretamente,
mapeia pelo número de família (ex: 2103 de LLE-2103.xxx.xxF) e aplica o custo
a todos os produtos do banco que pertencem à mesma família.

Regra: só aplica se TODOS os SKUs da planilha para aquela família têm o mesmo custo.
Se houver custos diferentes para a mesma família, não aplica (requer revisão manual).
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

cursor.execute("SELECT id, sku, produto, familia, custoCorpoOnoff220v, custoCorpoOnoffBivolt FROM products")
all_products = cursor.fetchall()

db_by_sku = {p['sku'].upper().strip(): p for p in all_products if p['sku']}

def has_custo(p):
    return (p.get('custoCorpoOnoff220v') and float(p['custoCorpoOnoff220v'] or 0) > 0) or \
           (p.get('custoCorpoOnoffBivolt') and float(p['custoCorpoOnoffBivolt'] or 0) > 0)

# ─── Prefixos equivalentes ────────────────────────────────────────────────────
PREFIX_ALTS = {
    'LLE': ['ALE','LLE'], 'LLS': ['ALS','LLS'], 'LLP': ['ALP','LLP'],
    'LDE': ['ADE','LDE'], 'LDS': ['ADS','LDS'], 'LDP': ['ADP','LDP'],
    'LDA': ['ADA','LDA'], 'LDB': ['ADB','LDB'], 'LFE': ['AFE','LFE'],
    'LFS': ['AFS','LFS'],
}

def extract_sku(col_a_val):
    s = str(col_a_val).strip()
    if ' - ' in s:
        s = s.split(' - ')[0].strip()
    return s.upper()

def extract_familia_num(sku):
    """Extrai o número de família do SKU. Ex: LLE-2103.450.28F → 2103"""
    m = re.match(r'^[A-Z]+-(\d+)', sku)
    return m.group(1) if m else None

def try_match_direct(sku):
    if sku in db_by_sku:
        return db_by_sku[sku]['id'], 'direto'
    prefix = sku[:3]
    suffix = sku[3:]
    for alt in PREFIX_ALTS.get(prefix, []):
        alt_sku = alt + suffix
        if alt_sku in db_by_sku:
            return db_by_sku[alt_sku]['id'], f'{prefix}→{alt}'
    return None, None

# ─── Ler planilha ─────────────────────────────────────────────────────────────
print("Lendo planilha...")
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

sku_data = {}  # SKU_LIMPO → {custo, mkp_padrao, mkp_minimo, drivers}

for row in ws.iter_rows(min_row=2, values_only=True):
    col_a = row[0]
    col_b = row[1]
    col_c = row[2]
    col_d = row[3]
    col_g = row[6] if len(row) > 6 else None

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
        if col_c: mkp_padrao = float(col_c)
    except: pass
    try:
        if col_d: mkp_minimo = float(col_d)
    except: pass

    driver_tipo = str(col_g).upper().strip() if col_g else ''

    if sku not in sku_data:
        sku_data[sku] = {'custo': custo, 'mkp_padrao': mkp_padrao, 'mkp_minimo': mkp_minimo, 'drivers': set()}
    if driver_tipo:
        sku_data[sku]['drivers'].add(driver_tipo)

wb.close()
del wb
gc.collect()

# ─── Separar já encontrados dos não encontrados ───────────────────────────────
nao_encontrados = []
for sku, dados in sku_data.items():
    prod_id, _ = try_match_direct(sku)
    if not prod_id:
        nao_encontrados.append((sku, dados))

print(f"SKUs não encontrados diretamente: {len(nao_encontrados)}")

# ─── Agrupar não encontrados por família ─────────────────────────────────────
# familia_num → lista de (sku, dados)
familia_map = {}
for sku, dados in nao_encontrados:
    fnum = extract_familia_num(sku)
    if fnum:
        familia_map.setdefault(fnum, []).append((sku, dados))

# ─── Para cada família, verificar se custo é consistente ─────────────────────
print("\n=== ANÁLISE POR FAMÍLIA ===")
familias_ok = {}   # fnum → dados_a_usar
familias_conflito = {}

for fnum, items in sorted(familia_map.items()):
    custos = set(round(d['custo'], 2) for _, d in items)
    mkps_p = set(round(d['mkp_padrao'], 2) for _, d in items if d['mkp_padrao'])
    mkps_m = set(round(d['mkp_minimo'], 2) for _, d in items if d['mkp_minimo'])
    
    # Produtos do banco com essa família
    banco_matches = [(s, p) for s, p in db_by_sku.items() if fnum in s]
    
    if len(custos) == 1:
        # Custo consistente — pode aplicar
        custo = list(custos)[0]
        mkp_p = list(mkps_p)[0] if len(mkps_p) == 1 else None
        mkp_m = list(mkps_m)[0] if len(mkps_m) == 1 else None
        drivers = set()
        for _, d in items:
            drivers |= d['drivers']
        
        familias_ok[fnum] = {
            'custo': custo, 'mkp_padrao': mkp_p, 'mkp_minimo': mkp_m,
            'drivers': drivers, 'banco_matches': banco_matches,
            'plan_skus': [s for s, _ in items]
        }
        print(f"  Família {fnum}: custo={custo:.4f} mkpP={mkp_p} mkpM={mkp_m} | {len(banco_matches)} produtos no banco | drivers={drivers}")
    else:
        familias_conflito[fnum] = {'custos': custos, 'items': items}
        print(f"  CONFLITO família {fnum}: custos={custos}")

# ─── Aplicar custos por família ───────────────────────────────────────────────
def get_driver_fields(drivers, custo, mkp_padrao, mkp_minimo):
    update = {}
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
        elif 'DIM' in d_up:
            drivers_norm.add('DIM110V')
    if not drivers_norm:
        drivers_norm = {'ONOFF', 'DIMDALI', 'DIM110V', 'DIMTRIAC110V', 'DIMTRIAC220V'}
    
    custo_str = str(round(custo, 4))
    mkp_p_str = str(round(mkp_padrao, 4)) if mkp_padrao else None
    mkp_m_str = str(round(mkp_minimo, 4)) if mkp_minimo else None
    
    for drv in drivers_norm:
        if drv == 'ONOFF':
            update['custoCorpoOnoff220v'] = custo_str
            update['custoCorpoOnoffBivolt'] = custo_str
            if mkp_p_str: update['mkpPadraoOnoff220v'] = mkp_p_str; update['mkpPadraoOnoffBivolt'] = mkp_p_str
            if mkp_m_str: update['mkpMinimoOnoff220v'] = mkp_m_str; update['mkpMinimoOnoffBivolt'] = mkp_m_str
        elif drv == 'DIM110V':
            update['custoCorpoDim110v'] = custo_str
            if mkp_p_str: update['mkpPadraoDim110v'] = mkp_p_str
            if mkp_m_str: update['mkpMinimoDim110v'] = mkp_m_str
        elif drv == 'DIMDALI':
            update['custoCorpoDimDali'] = custo_str
            if mkp_p_str: update['mkpPadraoDimDali'] = mkp_p_str
            if mkp_m_str: update['mkpMinimoDimDali'] = mkp_m_str
        elif drv == 'DIMTRIAC110V':
            update['custoCorpoDimTriac110v'] = custo_str
            if mkp_p_str: update['mkpPadraoDimTriac110v'] = mkp_p_str
            if mkp_m_str: update['mkpMinimoDimTriac110v'] = mkp_m_str
        elif drv == 'DIMTRIAC220V':
            update['custoCorpoDimTriac220v'] = custo_str
            if mkp_p_str: update['mkpPadraoDimTriac220v'] = mkp_p_str
            if mkp_m_str: update['mkpMinimoDimTriac220v'] = mkp_m_str
    return update

print(f"\n=== APLICANDO CUSTOS POR FAMÍLIA ===")
atualizados = 0
produtos_atualizados = []

for fnum, info in sorted(familias_ok.items()):
    banco_matches = info['banco_matches']
    if not banco_matches:
        print(f"  Família {fnum}: nenhum produto no banco")
        continue
    
    fields = get_driver_fields(info['drivers'], info['custo'], info['mkp_padrao'], info['mkp_minimo'])
    if not fields:
        continue
    
    set_clause = ', '.join([f"`{k}` = %s" for k in fields.keys()])
    
    for sku_banco, prod in banco_matches:
        # Só atualizar se não tem custo ainda OU se o custo é diferente
        prod_id = prod['id']
        values = list(fields.values()) + [prod_id]
        cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s", values)
        atualizados += 1
        produtos_atualizados.append(f"  {sku_banco} (família {fnum}, custo={info['custo']:.4f})")

conn.commit()
conn.close()

print(f"\n{'='*60}")
print(f"RESULTADO:")
print(f"  Produtos atualizados por família: {atualizados}")
print(f"  Famílias com conflito de custo: {len(familias_conflito)}")
print(f"{'='*60}")

print(f"\nProdutos atualizados:")
for p in produtos_atualizados:
    print(p)

if familias_conflito:
    print(f"\n=== FAMÍLIAS COM CONFLITO (requerem revisão manual) ===")
    for fnum, info in familias_conflito.items():
        print(f"  Família {fnum}: custos={info['custos']}")
        for sku, d in info['items']:
            print(f"    {sku}: custo={d['custo']:.4f}")

# Produtos ainda sem custo após tudo
print(f"\n=== SKUs REALMENTE AUSENTES DO BANCO ===")
ausentes = []
for sku, dados in nao_encontrados:
    fnum = extract_familia_num(sku)
    if fnum not in familias_ok:
        ausentes.append(sku)
for s in sorted(ausentes):
    print(f"  {s}")
print(f"Total: {len(ausentes)}")
