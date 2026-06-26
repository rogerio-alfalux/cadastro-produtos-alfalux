#!/usr/bin/env python3
"""Investiga os 86 SKUs não encontrados para identificar padrões de mapeamento."""
import json, re, gc
import mysql.connector

with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()
conn = mysql.connector.connect(host=host, port=int(port), user=user, password=password, database=dbname, ssl_disabled=False)
cursor = conn.cursor(dictionary=True)
cursor.execute("SELECT id, sku, produto, familia FROM products")
all_products = cursor.fetchall()
conn.close()

db_by_sku = {p['sku'].upper().strip(): p for p in all_products if p['sku']}

nao_enc = [
    'LDA-1027.1CO.38Q','LDA-5520.1AD.50F','LDB-9537.300.92P','LDB-9537.300.98P',
    'LDB-9537.400.51P','LDB-9537.400.52P','LDB-9537.500.51P','LDB-9537.500.52P',
    'LDE-1027.1CO.03S','LDE-1027.1CO.76D','LDE-1027.1CO.80D','LDE-1400.115.18B',
    'LDE-1400.120.19B','LDE-1400.150.19B','LDE-1400.225.18B','LDE-6000.1TC.60Q',
    'LDE-6450.140.18B','LDE-6451.DLS.18F','LDE-6453.225.18F','LDE-6455.1A4.18B',
    'LDE-6975.1CO.80F','LDP-4150.1CO.43C','LDP-4517.8AD.45B','LDP-4912.060.41P',
    'LDP-4912.090.41P','LDS-1027.1CO.03S','LDS-1027.1CO.35D','LDS-1027.1CO.72D',
    'LDS-1400 LUNA G RS','LDS-1400 LUNA GG QS','LDS-1400 LUNA PP QS','LDS-1400 LUNA PP QS 13W',
    'LDS-1400.100.18B','LDS-1400.150.19B','LDS-1400.200.15Q','LDS-1400.230.19B',
    'LDS-1600.1CO.03B','LDS-2300.1CO.02B','LDS-3420.1TC.77D','LDS-6000.1TC.15S',
    'LDS-7476.1G1.70N','LDS-7535.1CO.30B','LDS-7535.1CO.70B','LDS-7535.1T5.10B',
    'LDS-7535.1T5.15B','LDS-7786.1G1.70N','LDS-7840.1CO.78F','LDS-7841.1C1.75F',
    'LFE-8420.216.02F','LFE-8420.232.02F','LFE-8420.635.04F','LFS-3103.232.31F',
    'LFS-3420.232.38F','LLE-2103.232.01F','LLE-2103.450.08F','LLE-2118.150.08M',
    'LLE-2118.450.08M','LLE-2140.250.08F','LLE-2420.250.18F','LLE-2423.120.28F',
    'LLE-2750.124.21F','LLE-3110.124.40F','LLE-8420.124.19F','LLE-8420.635.03F',
    'LLE-8420.635.05F','LLS-2142.124.19F','LLS-2142.618.19F','LLS-3103.2BA.30F',
    'LLS-3103.450.30F','LLS-3103.4BA.30F','LLS-3466.113.38F','LLS-3466.170.38F',
    'LLS-3466.226.38F','LLS-3466.575.38F','LLS-3550.080.58B','LLS-3550.200.55B',
    'LLS-4110.115.40F','LLS-4110.172.40F','LLS-5331.115.48F','LLS-5331.575.48F',
    'LUNA GG QS','LUNA GG RS','ORBITAL QS COB50','ORBITAL RS COB50',
    'ORBITAL RS COB70','ORBITAL RS LENTE 70L',
]

# Prefixos a tentar
PREFIX_ALTS = {
    'LLE': ['ALE','LLE'], 'LLS': ['ALS','LLS'], 'LLP': ['ALP','LLP'],
    'LDE': ['ADE','LDE'], 'LDS': ['ADS','LDS'], 'LDP': ['ADP','LDP'],
    'LDA': ['ADA','LDA'], 'LDB': ['ADB','LDB'], 'LFE': ['AFE','LFE'],
    'LFS': ['AFS','LFS'],
}

print("=== SKUs NÃO ENCONTRADOS — BUSCA POR SUFIXO NO BANCO ===\n")

encontrados_sufixo = []
realmente_ausentes = []

for sku in nao_enc:
    # Tentar busca por sufixo parcial (últimos 10 chars)
    suffix = sku[-10:] if len(sku) >= 10 else sku
    matches = [(s, p) for s, p in db_by_sku.items() if suffix in s]
    
    # Tentar busca pelo número do modelo (parte entre hífens e ponto)
    model_part = sku.split('-')[1].split('.')[0] if '-' in sku and '.' in sku else ''
    model_matches = [(s, p) for s, p in db_by_sku.items() if model_part and model_part in s] if model_part else []
    
    if matches or model_matches:
        all_m = list({s: p for s, p in (matches + model_matches)}.items())
        print(f"  {sku}")
        for s, p in all_m[:5]:
            print(f"    → banco: {s} | {p['produto'][:40]}")
        encontrados_sufixo.append(sku)
    else:
        realmente_ausentes.append(sku)

print(f"\n=== REALMENTE AUSENTES DO BANCO ({len(realmente_ausentes)}) ===")
for sku in realmente_ausentes:
    print(f"  {sku}")

print(f"\nTotal com possível match por sufixo: {len(encontrados_sufixo)}")
print(f"Total realmente ausentes: {len(realmente_ausentes)}")

# Verificar especificamente LLE-2103, LLS-3466, LLE-2118 etc.
print("\n=== BUSCA ESPECÍFICA POR FAMÍLIA NO BANCO ===")
for familia_num in ['2103','3466','2118','2140','2420','2750','3103','3420','3550','4110','5331','8420','9465']:
    matches = [(s, p) for s, p in db_by_sku.items() if familia_num in s]
    if matches:
        print(f"\n  Família {familia_num} ({len(matches)} produtos):")
        for s, p in matches[:4]:
            print(f"    {s}")
