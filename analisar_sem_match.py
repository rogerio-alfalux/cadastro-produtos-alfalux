#!/usr/bin/env python3
"""Analisa os produtos sem match para entender quais famílias existem na planilha."""
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
           custoCorpoOnoff220v, custoCorpoOnoffBivolt,
           custoCorpoDim110v, custoCorpoDimDali
    FROM products ORDER BY sku
""")
all_products = cursor.fetchall()
conn.close()

def has_custo(p):
    for f in ['custoCorpoOnoff220v','custoCorpoOnoffBivolt','custoCorpoDim110v','custoCorpoDimDali']:
        v = p.get(f)
        if v and float(v) > 0:
            return True
    return False

sem_custo = [p for p in all_products if not has_custo(p)]
print(f"Sem custo: {len(sem_custo)}")

# Ler planilha
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active
plan_familias = {}  # fnum → {custo, descricao, skus}
for row in ws.iter_rows(min_row=2, values_only=True):
    col_a = row[0]; col_b = row[1]
    if col_a is None or col_b is None: continue
    try: custo = float(col_b)
    except: continue
    if custo <= 0: continue
    raw = str(col_a).strip()
    sku_plan = raw.split(' - ')[0].strip().upper() if ' - ' in raw else raw.upper()
    desc_plan = raw.split(' - ', 1)[1].strip().upper() if ' - ' in raw else ''
    sku_norm = re.sub(r'\s+', '', sku_plan)
    m2 = re.match(r'^[A-Z]+-(\d+)', sku_norm)
    if m2:
        fnum = m2.group(1)
        if fnum not in plan_familias:
            plan_familias[fnum] = {'custos': set(), 'skus': set(), 'descs': set()}
        plan_familias[fnum]['custos'].add(round(custo, 2))
        plan_familias[fnum]['skus'].add(sku_norm)
        plan_familias[fnum]['descs'].add(desc_plan[:40])
wb.close(); del wb; gc.collect()

print(f"Famílias na planilha: {len(plan_familias)}")

# Analisar sem match por família
banco_familias = {}  # fnum → lista de produtos
for prod in sem_custo:
    sku_b = re.sub(r'\s+', '', (prod['sku'] or '').upper().strip())
    m2 = re.match(r'^[A-Z]+-(\d+)', sku_b)
    if m2:
        fnum = m2.group(1)
        banco_familias.setdefault(fnum, []).append(prod)
    else:
        banco_familias.setdefault('SEM_FAMILIA', []).append(prod)

print(f"\n=== FAMÍLIAS SEM CUSTO NO BANCO vs PLANILHA ===")
print(f"{'Família':<10} {'Banco':<6} {'Na planilha?':<15} {'Custos planilha'}")
na_planilha = 0
fora_planilha = 0
for fnum in sorted(banco_familias.keys()):
    prods = banco_familias[fnum]
    if fnum in plan_familias:
        custos = plan_familias[fnum]['custos']
        skus_plan = plan_familias[fnum]['skus']
        print(f"  {fnum:<10} {len(prods):<6} SIM ({len(skus_plan)} SKUs)    custos={sorted(custos)[:4]}")
        na_planilha += len(prods)
    else:
        print(f"  {fnum:<10} {len(prods):<6} NÃO")
        fora_planilha += len(prods)

print(f"\nTotal com família na planilha: {na_planilha}")
print(f"Total sem família na planilha: {fora_planilha}")

# Mostrar detalhes das famílias com custo único (pode aplicar direto)
print(f"\n=== FAMÍLIAS COM CUSTO ÚNICO NA PLANILHA (pode aplicar a todos) ===")
for fnum in sorted(banco_familias.keys()):
    if fnum in plan_familias:
        custos = plan_familias[fnum]['custos']
        if len(custos) == 1:
            custo = list(custos)[0]
            prods = banco_familias[fnum]
            print(f"  Família {fnum}: custo={custo} → {len(prods)} produtos no banco")
            for p in prods[:3]:
                print(f"    {p['sku']:<30} {p['produto'][:40]}")
            if len(prods) > 3:
                print(f"    ... +{len(prods)-3} mais")

print(f"\n=== FAMÍLIAS COM MÚLTIPLOS CUSTOS NA PLANILHA ===")
for fnum in sorted(banco_familias.keys()):
    if fnum in plan_familias:
        custos = plan_familias[fnum]['custos']
        if len(custos) > 1:
            prods = banco_familias[fnum]
            skus_plan = sorted(plan_familias[fnum]['skus'])
            print(f"\n  Família {fnum}: {len(custos)} custos diferentes, {len(prods)} produtos no banco")
            print(f"    SKUs na planilha: {skus_plan[:5]}")
            print(f"    Custos: {sorted(custos)}")
            print(f"    Produtos no banco:")
            for p in prods[:5]:
                print(f"      {p['sku']:<30} {p['produto'][:40]}")
