#!/usr/bin/env python3
"""
Analisa como os SKUs da planilha se relacionam com os SKUs do banco.
Entende o mapeamento LLE->ALE, LLS->ALS, LLP->ALP etc.
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
print(f"Total de produtos no banco: {len(db_sku_map)}")

# Carregar planilha
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

# Extrair SKUs únicos da planilha
planilha_skus = set()
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[0]:
        desc = str(row[0]).strip()
        parts = desc.split(' - ', 1)
        if parts:
            planilha_skus.add(parts[0].strip())
wb.close()

print(f"Total de SKUs únicos na planilha: {len(planilha_skus)}")

# Mapeamento de prefixos: L_E -> A_E, L_S -> A_S, L_P -> A_P
def converter_sku(sku):
    """Converte SKU da planilha para o equivalente no banco."""
    # LLE -> ALE, LLS -> ALS, LLP -> ALP, LDE -> ADE, LDS -> ADS, LDP -> ADP, LDB -> ADB etc.
    # Padrão: L[A-Z][A-Z] -> A[A-Z][A-Z] (troca L por A no prefixo)
    m = re.match(r'^L([A-Z]{2})(-.+)$', sku)
    if m:
        return f'A{m.group(1)}{m.group(2)}'
    return sku

# Verificar matches
encontrados = []
nao_encontrados = []
for sku in sorted(planilha_skus):
    # Tentar match direto
    if sku in db_sku_map:
        encontrados.append((sku, sku, 'direto'))
        continue
    # Tentar com conversão L->A
    sku_conv = converter_sku(sku)
    if sku_conv in db_sku_map:
        encontrados.append((sku, sku_conv, 'L->A'))
        continue
    nao_encontrados.append(sku)

print(f"\nSKUs encontrados no banco: {len(encontrados)}")
print(f"SKUs NÃO encontrados no banco: {len(nao_encontrados)}")

print("\n=== SKUs encontrados (primeiros 30) ===")
for orig, conv, tipo in encontrados[:30]:
    if tipo == 'L->A':
        print(f"  {orig} -> {conv} ({tipo})")
    else:
        print(f"  {orig} (direto)")

print("\n=== SKUs NÃO encontrados no banco ===")
for sku in nao_encontrados:
    sku_conv = converter_sku(sku)
    print(f"  {sku} (tentou: {sku_conv})")

cursor.close()
conn.close()
