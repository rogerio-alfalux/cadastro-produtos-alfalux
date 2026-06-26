#!/usr/bin/env python3
"""
Entende a estrutura do SKU e como os SKUs da planilha se relacionam com o banco.
O SKU no banco tem formato: PREFIX-NNNN.NNN.NNX (ex: LLE-2140.250.08F)
O SKU na planilha pode ser: LLE-2140.250.08F (mesmo) ou LDS-7840.1CO.71F (diferente)
"""
import openpyxl
import re
import json
import mysql.connector
from collections import defaultdict

with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()
conn = mysql.connector.connect(host=host, port=int(port), user=user, password=password, database=dbname, ssl_disabled=False)
cursor = conn.cursor(dictionary=True)

cursor.execute('SELECT id, sku FROM products')
db_products = cursor.fetchall()
db_sku_map = {r['sku'].strip(): r['id'] for r in db_products}

# Carregar planilha e extrair todos os dados
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

rows_data = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[0]:
        rows_data.append(row)
wb.close()

# Verificar os SKUs LLE, LLS que não foram encontrados
# Talvez eles existam no banco com o mesmo prefixo mas o sufixo é diferente
# Vamos verificar os SKUs LLE da planilha vs banco
print("=== SKUs LLE na planilha ===")
lle_planilha = set()
for r in rows_data:
    sku = str(r[0]).split(' - ')[0].strip()
    if sku.startswith('LLE-'):
        lle_planilha.add(sku)
for s in sorted(lle_planilha):
    existe = s in db_sku_map
    print(f"  {'[OK]' if existe else '[--]'} {s}")

print("\n=== SKUs LLE no banco (primeiros 30) ===")
lle_banco = sorted([s for s in db_sku_map if s.startswith('LLE-')])[:30]
for s in lle_banco:
    print(f"  {s}")

print("\n=== SKUs LLS na planilha ===")
lls_planilha = set()
for r in rows_data:
    sku = str(r[0]).split(' - ')[0].strip()
    if sku.startswith('LLS-'):
        lls_planilha.add(sku)
for s in sorted(lls_planilha):
    existe = s in db_sku_map
    print(f"  {'[OK]' if existe else '[--]'} {s}")

print("\n=== SKUs LLS no banco (primeiros 30) ===")
lls_banco = sorted([s for s in db_sku_map if s.startswith('LLS-')])[:30]
for s in lls_banco:
    print(f"  {s}")

print("\n=== SKUs LDS na planilha ===")
lds_planilha = set()
for r in rows_data:
    sku = str(r[0]).split(' - ')[0].strip()
    if sku.startswith('LDS-'):
        lds_planilha.add(sku)
for s in sorted(lds_planilha):
    existe = s in db_sku_map
    print(f"  {'[OK]' if existe else '[--]'} {s}")

print("\n=== SKUs LDS no banco ===")
lds_banco = sorted([s for s in db_sku_map if s.startswith('LDS-')])
for s in lds_banco:
    print(f"  {s}")

cursor.close()
conn.close()
