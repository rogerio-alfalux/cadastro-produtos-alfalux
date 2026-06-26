#!/usr/bin/env python3
"""Investiga os 95 produtos sem match para identificar correspondências na planilha."""
import json, re, gc
import mysql.connector
import openpyxl

with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()
conn = mysql.connector.connect(host=host, port=int(port), user=user, password=password, database=dbname, ssl_disabled=False)
cursor = conn.cursor(dictionary=True)
cursor.execute("""
    SELECT id, sku, produto, familia, categoria,
           driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali,
           driverDimTriac110v, driverDimTriac220v,
           driverDim110vNaoAplicavel, driverDimDaliNaoAplicavel,
           driverDimTriac110vNaoAplicavel, driverDimTriac220vNaoAplicavel,
           custoCorpoOnoff220v, custoCorpoOnoffBivolt,
           custoCorpoDim110v, custoCorpoDimDali
    FROM products ORDER BY sku
""")
all_products = cursor.fetchall()
conn.close()

CUSTO_FIELDS = ['custoCorpoOnoff220v','custoCorpoOnoffBivolt','custoCorpoDim110v','custoCorpoDimDali']
def has_custo(p):
    for f in CUSTO_FIELDS:
        v = p.get(f)
        if v and float(v) > 0: return True
    return False

sem_custo = [p for p in all_products
             if not has_custo(p) and (p.get('categoria') or '').upper() not in ('PERFIS','PERFIL')]
print(f"Sem custo (excl. perfis): {len(sem_custo)}")

# Ler planilha — TODAS as linhas com SKU e custo
print("Lendo planilha...")
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

# Coletar TODOS os pares (sku_norm, custo, desc) da planilha
planilha_all = []
planilha_skus_first = {}  # SKU_NORM → primeira ocorrência

for row in ws.iter_rows(min_row=2, values_only=True):
    col_a = row[0]; col_b = row[1]; col_c = row[2]; col_d = row[3]
    if col_a is None or col_b is None: continue
    try: custo = float(col_b)
    except: continue
    if custo <= 0: continue
    raw = str(col_a).strip()
    sku_plan = raw.split(' - ')[0].strip().upper() if ' - ' in raw else raw.upper()
    desc_plan = raw.split(' - ', 1)[1].strip().upper() if ' - ' in raw else ''
    sku_norm = re.sub(r'\s+', '', sku_plan)
    if not sku_norm or sku_norm == 'DESCRIÇÃODOPRODUTO': continue
    mkp_padrao = None; mkp_minimo = None
    try:
        if col_c: mkp_padrao = float(col_c)
    except: pass
    try:
        if col_d: mkp_minimo = float(col_d)
    except: pass
    entry = {'sku': sku_norm, 'custo': custo, 'mkp_padrao': mkp_padrao,
             'mkp_minimo': mkp_minimo, 'descricao': desc_plan}
    planilha_all.append(entry)
    if sku_norm not in planilha_skus_first:
        planilha_skus_first[sku_norm] = entry

wb.close(); del wb; gc.collect()
print(f"Linhas na planilha: {len(planilha_all)}, SKUs únicos: {len(planilha_skus_first)}")

def norm_sku(sku):
    return re.sub(r'\s+', '', (sku or '').upper().strip())

def extract_familia_num(sku):
    m2 = re.match(r'^[A-Z]+-(\d+)', norm_sku(sku))
    return m2.group(1) if m2 else None

# Indexar planilha por família
plan_by_familia = {}
for entry in planilha_all:
    fnum = extract_familia_num(entry['sku'])
    if fnum:
        plan_by_familia.setdefault(fnum, []).append(entry)

PREFIX_ALTS = {
    'LLE': ['ALE'], 'LLS': ['ALS'], 'LLP': ['ALP'],
    'LDE': ['ADE'], 'LDS': ['ADS'], 'LDP': ['ADP'],
    'LDA': ['ADA'], 'LDB': ['ADB'], 'LFE': ['AFE'], 'LFS': ['AFS'],
    'ALE': ['LLE'], 'ALS': ['LLS'], 'ALP': ['LLP'],
    'ADE': ['LDE'], 'ADS': ['LDS'], 'ADP': ['LDP'],
    'ADA': ['LDA'], 'ADB': ['LDB'], 'AFE': ['LFE'], 'AFS': ['LFS'],
    'LDN': ['LDE', 'ADE', 'LDS'], 'LDC': ['LDE', 'ADE'],
}

print("\n=== ANÁLISE DOS SEM MATCH ===")
encontrados = []
nao_encontrados = []

for prod in sem_custo:
    sku_b = norm_sku(prod['sku'] or '')
    fnum = extract_familia_num(sku_b)
    desc_b = (prod['produto'] or '').upper()
    
    # Verificar se família existe na planilha
    familia_na_planilha = fnum and fnum in plan_by_familia
    
    if familia_na_planilha:
        items = plan_by_familia[fnum]
        custos_familia = set(round(e['custo'], 2) for e in items)
        skus_familia = sorted(set(e['sku'] for e in items))
        print(f"\n  {sku_b} | {desc_b[:40]}")
        print(f"    Família {fnum} na planilha: {len(items)} linhas, {len(custos_familia)} custos: {sorted(custos_familia)[:5]}")
        print(f"    SKUs planilha: {skus_familia[:4]}")
        encontrados.append(prod)
    else:
        nao_encontrados.append(prod)

print(f"\n\n=== RESUMO ===")
print(f"Com família na planilha: {len(encontrados)}")
print(f"Sem família na planilha (realmente ausentes): {len(nao_encontrados)}")

print(f"\n=== REALMENTE AUSENTES ({len(nao_encontrados)}) ===")
# Agrupar por família
from collections import defaultdict
por_familia = defaultdict(list)
for prod in nao_encontrados:
    fnum = extract_familia_num(norm_sku(prod['sku'] or '')) or 'SEM_FAMILIA'
    por_familia[fnum].append(prod)

for fnum in sorted(por_familia.keys()):
    prods = por_familia[fnum]
    print(f"  Família {fnum}: {len(prods)} produtos")
    for p in prods[:2]:
        print(f"    {p['sku']:<32} {p['produto'][:40]}")
    if len(prods) > 2:
        print(f"    ... +{len(prods)-2} mais")
