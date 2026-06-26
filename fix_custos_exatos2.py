#!/usr/bin/env python3
"""
Corrige custos de luminárias no banco usando valores EXATOS da coluna B da planilha.
Regra de prioridade: se um SKU da planilha tem match DIRETO no banco, usa esse custo.
Se o match é por sufixo (ex: LLS→LLE), só aplica se não houver outro SKU da planilha
com match direto para o mesmo produto do banco.
"""
import openpyxl
import re
import json
import mysql.connector
from decimal import Decimal
from collections import defaultdict

# ─── Conexão ────────────────────────────────────────────────────────────────
with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()
conn = mysql.connector.connect(host=host, port=int(port), user=user, password=password, database=dbname, ssl_disabled=False)
cursor = conn.cursor(dictionary=True)

# ─── Carregar produtos do banco ──────────────────────────────────────────────
cursor.execute('SELECT id, sku FROM products')
db_products = cursor.fetchall()
db_sku_to_id = {r['sku'].strip(): r['id'] for r in db_products}

db_suffix_to_skus = defaultdict(list)
for sku, pid in db_sku_to_id.items():
    m2 = re.match(r'^([A-Z]{3,4})(-?.+)$', sku)
    if m2:
        db_suffix_to_skus[m2.group(2)].append((sku, pid))

def encontrar_produto(planilha_sku):
    sku = planilha_sku.strip()
    if sku in db_sku_to_id:
        return db_sku_to_id[sku], sku, 'direto'
    m2 = re.match(r'^([A-Z]{3,4})(-?.+)$', sku)
    if m2:
        sufixo = m2.group(2)
        matches = db_suffix_to_skus.get(sufixo, [])
        if len(matches) == 1:
            return matches[0][1], matches[0][0], f'sufixo({m2.group(1)}->{matches[0][0][:3]})'
        elif len(matches) > 1:
            for db_sku, pid in matches:
                if db_sku.startswith(m2.group(1)):
                    return pid, db_sku, 'sufixo-mesmo-prefixo'
            return matches[0][1], matches[0][0], f'sufixo-multi({len(matches)})'
    return None, None, 'não encontrado'

# ─── Campos de custo do corpo ────────────────────────────────────────────────
CUSTO_D1_CAMPOS = [
    'custoCorpoOnoff220v', 'custoCorpoOnoffBivolt',
    'custoCorpoDim110v', 'custoCorpoDimDali',
    'custoCorpoDimTriac110v', 'custoCorpoDimTriac220v',
]
CUSTO_D1D2_CAMPOS = [
    'custoCorpoOnoff220vD1D2', 'custoCorpoOnoffBivoltD1D2',
    'custoCorpoDim110vD1D2', 'custoCorpoDimDaliD1D2',
    'custoCorpoDimTriac110vD1D2', 'custoCorpoDimTriac220vD1D2',
]

# ─── Carregar planilha ───────────────────────────────────────────────────────
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

sku_custo = {}
sku_is_d1d2 = {}

for row in ws.iter_rows(min_row=2, values_only=True):
    if not row[0]:
        continue
    desc = str(row[0]).strip()
    custo_raw = row[1]
    parts = desc.split(' - ', 1)
    sku_planilha = parts[0].strip()
    desc_resto = parts[1].strip() if len(parts) > 1 else ''
    is_d1d2 = bool(re.search(r'\bD1/D2\b', desc_resto, re.IGNORECASE))

    if custo_raw is not None:
        custo_decimal = Decimal(str(custo_raw))
        if sku_planilha not in sku_custo:
            sku_custo[sku_planilha] = custo_decimal
            sku_is_d1d2[sku_planilha] = is_d1d2
        if is_d1d2:
            sku_is_d1d2[sku_planilha] = True

wb.close()

# ─── Resolver conflitos: para cada produto do banco, usar o SKU com match DIRETO
# se houver, caso contrário usar o match por sufixo
produto_melhor_match = {}  # pid -> (sku_planilha, custo, is_d1d2, tipo_match)

for sku_planilha, custo in sku_custo.items():
    pid, db_sku, tipo_match = encontrar_produto(sku_planilha)
    if pid is None:
        continue
    is_d1d2 = sku_is_d1d2.get(sku_planilha, False)
    prioridade = 0 if tipo_match == 'direto' else 1

    if pid not in produto_melhor_match:
        produto_melhor_match[pid] = (sku_planilha, db_sku, custo, is_d1d2, tipo_match, prioridade)
    else:
        _, _, _, _, _, prio_atual = produto_melhor_match[pid]
        if prioridade < prio_atual:
            # Match direto tem prioridade sobre sufixo
            produto_melhor_match[pid] = (sku_planilha, db_sku, custo, is_d1d2, tipo_match, prioridade)
            print(f"  CONFLITO RESOLVIDO: produto {db_sku} — usando {sku_planilha} (direto) em vez de sufixo")

print(f"Produtos a atualizar: {len(produto_melhor_match)}")

# ─── Atualizar banco ─────────────────────────────────────────────────────────
total_atualizados = 0
divergencias = []

for pid, (sku_p, db_sku, custo_decimal, is_d1d2, tipo_match, _) in sorted(produto_melhor_match.items()):
    campos = CUSTO_D1_CAMPOS.copy()
    if is_d1d2:
        campos += CUSTO_D1D2_CAMPOS

    # Verificar valor atual
    cursor.execute('SELECT custoCorpoOnoff220v FROM products WHERE id = %s', (pid,))
    row = cursor.fetchone()
    custo_atual = row['custoCorpoOnoff220v'] if row else None

    if custo_atual is not None:
        custo_atual_dec = Decimal(str(custo_atual))
        diff = abs(custo_atual_dec - custo_decimal)
        if diff > Decimal('0.001'):
            divergencias.append((sku_p, db_sku, float(custo_atual_dec), float(custo_decimal), tipo_match))

    set_clauses = ', '.join([f'`{c}` = %s' for c in campos])
    values = [float(custo_decimal)] * len(campos) + [pid]
    cursor.execute(f'UPDATE products SET {set_clauses} WHERE id = %s', values)
    total_atualizados += 1

conn.commit()

print(f"\n{'='*60}")
print(f"RESULTADO:")
print(f"  Produtos atualizados: {total_atualizados}")
print(f"  Divergências significativas corrigidas (>R$0,001): {len(divergencias)}")
print(f"{'='*60}")

if divergencias:
    print(f"\n=== Divergências corrigidas ===")
    for sku_p, sku_b, antes, depois, tipo in divergencias:
        diff = depois - antes
        print(f"  {sku_p} (banco: {sku_b}) [{tipo}]: R$ {antes:.4f} → R$ {depois:.4f}  (diff: {diff:+.4f})")

cursor.close()
conn.close()
