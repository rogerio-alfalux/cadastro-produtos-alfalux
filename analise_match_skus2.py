#!/usr/bin/env python3
"""
Busca correspondências mais amplas entre SKUs da planilha e banco.
Testa múltiplas estratégias de conversão de prefixo.
"""
import openpyxl
import re
import json
import mysql.connector
from collections import defaultdict

# Conectar ao banco
with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()
conn = mysql.connector.connect(host=host, port=int(port), user=user, password=password, database=dbname, ssl_disabled=False)
cursor = conn.cursor(dictionary=True)

# Buscar todos os SKUs do banco
cursor.execute('SELECT id, sku FROM products')
db_products = cursor.fetchall()
db_sku_map = {r['sku'].strip(): r['id'] for r in db_products}

# Criar índice por sufixo (parte após o prefixo de 3 letras)
# Ex: "ALE-2140.250.08F" -> sufixo = "-2140.250.08F"
db_suffix_map = defaultdict(list)
for sku in db_sku_map:
    m2 = re.match(r'^([A-Z]{3})(-?.+)$', sku)
    if m2:
        db_suffix_map[m2.group(2)].append((sku, m2.group(1)))

# Carregar planilha
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

planilha_skus = set()
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[0]:
        desc = str(row[0]).strip()
        parts = desc.split(' - ', 1)
        if parts:
            planilha_skus.add(parts[0].strip())
wb.close()

print(f"Total de SKUs únicos na planilha: {len(planilha_skus)}")

# Para cada SKU da planilha, tentar encontrar no banco
encontrados = {}
nao_encontrados = []

for sku in sorted(planilha_skus):
    # 1. Match direto
    if sku in db_sku_map:
        encontrados[sku] = (sku, 'direto')
        continue
    
    # 2. Extrair sufixo e buscar no banco
    m2 = re.match(r'^([A-Z]{3})(-?.+)$', sku)
    if m2:
        sufixo = m2.group(2)
        if sufixo in db_suffix_map:
            matches = db_suffix_map[sufixo]
            if len(matches) == 1:
                encontrados[sku] = (matches[0][0], f'{m2.group(1)}->{matches[0][1]}')
                continue
            elif len(matches) > 1:
                # Múltiplos matches - listar todos
                encontrados[sku] = (matches[0][0], f'MULTI:{[x[0] for x in matches]}')
                continue
    
    nao_encontrados.append(sku)

print(f"SKUs encontrados: {len(encontrados)}")
print(f"SKUs NÃO encontrados: {len(nao_encontrados)}")

print("\n=== Mapeamentos de prefixo usados ===")
tipo_count = defaultdict(int)
for orig, (conv, tipo) in encontrados.items():
    tipo_count[tipo] += 1
for tipo, count in sorted(tipo_count.items(), key=lambda x: -x[1]):
    print(f"  {tipo}: {count}")

print("\n=== SKUs com múltiplos matches ===")
for orig, (conv, tipo) in encontrados.items():
    if tipo.startswith('MULTI:'):
        print(f"  {orig} -> {tipo}")

print("\n=== SKUs NÃO encontrados ===")
for sku in nao_encontrados:
    print(f"  {sku}")

# Verificar prefixos únicos no banco
print("\n=== Prefixos únicos no banco ===")
prefixos_banco = defaultdict(int)
for sku in db_sku_map:
    m2 = re.match(r'^([A-Z]{3})', sku)
    if m2:
        prefixos_banco[m2.group(1)] += 1
for p, c in sorted(prefixos_banco.items(), key=lambda x: -x[1])[:20]:
    print(f"  {p}: {c} produtos")

cursor.close()
conn.close()
