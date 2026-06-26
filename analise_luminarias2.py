#!/usr/bin/env python3
"""Analisa em detalhes a planilha de custos de luminárias."""
import openpyxl
import re
from collections import Counter, defaultdict

wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

rows = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if any(v is not None for v in row):
        rows.append(row)

print(f"Total de linhas não-vazias: {len(rows)}")
print()

# Analisar coluna de descrição (col 0) para entender o padrão do SKU
# Formato: "LDA-XXXX.YYYY - DESCRIÇÃO D1 LED XW" ou "LDA-XXXX.YYYY - DESCRIÇÃO D1/D2 LED XW"
print("=== Exemplos de descrições únicas (primeiras 30) ===")
descricoes = set()
for r in rows:
    if r[0]:
        descricoes.add(str(r[0]).strip())

for d in sorted(descricoes)[:30]:
    print(f"  {d}")

print()
print(f"Total de descrições únicas: {len(descricoes)}")

# Analisar tipos de driver
print("\n=== Tipos de driver únicos ===")
tipos = Counter()
for r in rows:
    if r[6]:
        tipos[str(r[6]).strip()] += 1
for t, c in tipos.most_common():
    print(f"  [{c:3d}x] {t}")

# Analisar padrão do SKU na descrição
print("\n=== Padrão de extração de SKU ===")
# O SKU parece ser a parte antes do " - "
skus = Counter()
for r in rows:
    if r[0]:
        desc = str(r[0]).strip()
        # Extrair SKU: parte antes do primeiro " - "
        parts = desc.split(' - ', 1)
        if parts:
            sku = parts[0].strip()
            skus[sku] += 1

print(f"Total de SKUs únicos na planilha: {len(skus)}")
print("Exemplos de SKUs:")
for sku, count in list(skus.most_common())[:20]:
    print(f"  [{count:2d}x] {sku}")

# Verificar padrão D1/D2 vs D1 + D2
print("\n=== Padrão D1/D2 na descrição ===")
d1d2_count = sum(1 for d in descricoes if 'D1/D2' in d.upper())
d1_only = sum(1 for d in descricoes if re.search(r'\bD1\b', d.upper()) and 'D1/D2' not in d.upper())
d2_only = sum(1 for d in descricoes if re.search(r'\bD2\b', d.upper()) and 'D1/D2' not in d.upper())
print(f"  Descrições com D1/D2: {d1d2_count}")
print(f"  Descrições com apenas D1: {d1_only}")
print(f"  Descrições com apenas D2: {d2_only}")

# Verificar prefixos LLE/LLS/LLP vs ALE/ALS/ALP
print("\n=== Prefixos de SKU ===")
prefixos = Counter()
for sku in skus:
    m = re.match(r'^([A-Z]{3})', sku)
    if m:
        prefixos[m.group(1)] += 1
for p, c in prefixos.most_common():
    print(f"  {p}: {c} SKUs")

wb.close()
