#!/usr/bin/env python3
"""
Atualiza custos e markups de luminárias a partir da planilha TabelavendasLuminárias25.06.26final.xlsx.

Campos no banco:
  D1 (simples): custoCorpoOnoff220v, custoCorpoOnoffBivolt, custoCorpoDim110v, custoCorpoDimDali,
                custoCorpoDimTriac110v, custoCorpoDimTriac220v
  D1D2:         custoCorpoOnoff220vD1D2, custoCorpoOnoffBivoltD1D2, custoCorpoDim110vD1D2,
                custoCorpoDimDaliD1D2, custoCorpoDimTriac110vD1D2, custoCorpoDimTriac220vD1D2
  Markups D1:   mkpPadraoOnoff220v, mkpMinimoOnoff220v, mkpPadraoOnoffBivolt, mkpMinimoOnoffBivolt,
                mkpPadraoDim110v, mkpMinimoDim110v, mkpPadraoDimDali, mkpMinimoDimDali,
                mkpPadraoDimTriac110v, mkpMinimoDimTriac110v, mkpPadraoDimTriac220v, mkpMinimoDimTriac220v
  (Não há campos de markup D1D2 separados — usar os mesmos campos de markup D1)

Regras:
  - D1/D2 na planilha -> atualizar campos D1D2 do banco
  - D1 ou sem marcação -> atualizar campos D1 do banco
  - D2 isolado -> atualizar campos D1D2 do banco (D2 = segundo módulo)
  - Tipo ON-OFF -> campos Onoff220v e OnoffBivolt
  - Tipo DIM -> campos Dim110v, DimDali, DimTriac110v, DimTriac220v
  - Quando há ambos ON-OFF e DIM para o mesmo SKU, todos os campos são preenchidos
"""
import openpyxl
import re
import json
import mysql.connector
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

# Índice por sufixo para busca fuzzy (troca de prefixo)
db_suffix_to_skus = defaultdict(list)
for sku, pid in db_sku_to_id.items():
    m2 = re.match(r'^([A-Z]{3,4})(-?.+)$', sku)
    if m2:
        db_suffix_to_skus[m2.group(2)].append((sku, pid))

def encontrar_produto(planilha_sku):
    """Tenta encontrar o produto no banco pelo SKU da planilha."""
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

# ─── Mapeamento de campos ────────────────────────────────────────────────────
# Campos de custo do corpo: D1 (simples) e D1D2
CUSTO_D1 = {
    'onoff220':    'custoCorpoOnoff220v',
    'bivolt':      'custoCorpoOnoffBivolt',
    'dim110v':     'custoCorpoDim110v',
    'dimDali':     'custoCorpoDimDali',
    'dimTriac110': 'custoCorpoDimTriac110v',
    'dimTriac220': 'custoCorpoDimTriac220v',
}
CUSTO_D1D2 = {
    'onoff220':    'custoCorpoOnoff220vD1D2',
    'bivolt':      'custoCorpoOnoffBivoltD1D2',
    'dim110v':     'custoCorpoDim110vD1D2',
    'dimDali':     'custoCorpoDimDaliD1D2',
    'dimTriac110': 'custoCorpoDimTriac110vD1D2',
    'dimTriac220': 'custoCorpoDimTriac220vD1D2',
}
MKP_PADRAO = {
    'onoff220':    'mkpPadraoOnoff220v',
    'bivolt':      'mkpPadraoOnoffBivolt',
    'dim110v':     'mkpPadraoDim110v',
    'dimDali':     'mkpPadraoDimDali',
    'dimTriac110': 'mkpPadraoDimTriac110v',
    'dimTriac220': 'mkpPadraoDimTriac220v',
}
MKP_MINIMO = {
    'onoff220':    'mkpMinimoOnoff220v',
    'bivolt':      'mkpMinimoOnoffBivolt',
    'dim110v':     'mkpMinimoDim110v',
    'dimDali':     'mkpMinimoDimDali',
    'dimTriac110': 'mkpMinimoDimTriac110v',
    'dimTriac220': 'mkpMinimoDimTriac220v',
}

ONOFF_KEYS = ['onoff220', 'bivolt']
DIM_KEYS = ['dim110v', 'dimDali', 'dimTriac110', 'dimTriac220']

# ─── Carregar planilha ───────────────────────────────────────────────────────
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

# Agregar dados por SKU da planilha
# Para cada SKU: coletar custo, mkps, tipos de driver, e flags D1/D2
planilha_data = {}

for row in ws.iter_rows(min_row=2, values_only=True):
    if not row[0]:
        continue
    desc = str(row[0]).strip()
    custo = row[1]
    mkp_padrao = row[2]
    mkp_minimo = row[3]
    tipo_driver = str(row[6]).strip().upper() if row[6] else ''

    parts = desc.split(' - ', 1)
    sku_planilha = parts[0].strip()
    desc_resto = parts[1].strip() if len(parts) > 1 else ''

    # Detectar D1/D2 vs D1 vs D2 na descrição
    is_d1d2 = bool(re.search(r'\bD1/D2\b', desc_resto, re.IGNORECASE))
    is_d1 = bool(re.search(r'\bD1\b', desc_resto, re.IGNORECASE)) and not is_d1d2
    is_d2 = bool(re.search(r'\bD2\b', desc_resto, re.IGNORECASE)) and not is_d1d2

    if sku_planilha not in planilha_data:
        planilha_data[sku_planilha] = {
            'custo': custo,
            'mkp_padrao': mkp_padrao,
            'mkp_minimo': mkp_minimo,
            'tipos': set(),
            'is_d1d2': False,
            'is_d1': False,
            'is_d2': False,
        }

    entry = planilha_data[sku_planilha]
    if is_d1d2:
        entry['is_d1d2'] = True
    if is_d1:
        entry['is_d1'] = True
    if is_d2:
        entry['is_d2'] = True
    # Atualizar custo/mkp se ainda não definido
    if entry['custo'] is None and custo is not None:
        entry['custo'] = custo
    if entry['mkp_padrao'] is None and mkp_padrao is not None:
        entry['mkp_padrao'] = mkp_padrao
    if entry['mkp_minimo'] is None and mkp_minimo is not None:
        entry['mkp_minimo'] = mkp_minimo

    if tipo_driver in ('ON-OFF', 'DIM'):
        entry['tipos'].add(tipo_driver)

wb.close()

print(f"SKUs únicos na planilha: {len(planilha_data)}")

# ─── Processar e atualizar ───────────────────────────────────────────────────
total_atualizados = 0
total_nao_encontrados = 0
nao_encontrados_lista = []
atualizados_lista = []

for sku_planilha, dados in sorted(planilha_data.items()):
    pid, db_sku, tipo_match = encontrar_produto(sku_planilha)

    if pid is None:
        total_nao_encontrados += 1
        nao_encontrados_lista.append(sku_planilha)
        continue

    custo = dados['custo']
    mkp_padrao = dados['mkp_padrao']
    mkp_minimo = dados['mkp_minimo']
    tipos = dados['tipos']
    is_d1d2 = dados['is_d1d2']
    is_d1 = dados['is_d1']
    is_d2 = dados['is_d2']

    # Determinar quais grupos de campos atualizar
    # D1/D2 ou D2 isolado -> campos D1D2
    # D1 ou sem marcação -> campos D1 (simples)
    grupos_custo = []
    if is_d1d2 or is_d2:
        grupos_custo.append('D1D2')
    if is_d1 or (not is_d1d2 and not is_d2):
        grupos_custo.append('D1')

    # Determinar quais tipos de driver atualizar
    if not tipos:
        tipos = {'ON-OFF', 'DIM'}  # sem tipo explícito = atualiza todos

    updates = {}
    for grupo in grupos_custo:
        custo_map = CUSTO_D1 if grupo == 'D1' else CUSTO_D1D2

        keys_to_update = []
        if 'ON-OFF' in tipos:
            keys_to_update.extend(ONOFF_KEYS)
        if 'DIM' in tipos:
            keys_to_update.extend(DIM_KEYS)

        for key in keys_to_update:
            # Custo
            campo_custo = custo_map.get(key)
            if campo_custo and custo is not None:
                updates[campo_custo] = custo
            # Markup padrão (apenas para campos D1 — não há versão D1D2 separada)
            if grupo == 'D1':
                campo_mkp_p = MKP_PADRAO.get(key)
                if campo_mkp_p and mkp_padrao is not None:
                    updates[campo_mkp_p] = mkp_padrao
                campo_mkp_m = MKP_MINIMO.get(key)
                if campo_mkp_m and mkp_minimo is not None:
                    updates[campo_mkp_m] = mkp_minimo

    if updates:
        set_clauses = ', '.join([f'`{k}` = %s' for k in updates.keys()])
        values = list(updates.values()) + [pid]
        cursor.execute(f'UPDATE products SET {set_clauses} WHERE id = %s', values)
        total_atualizados += 1
        atualizados_lista.append((sku_planilha, db_sku, tipo_match, len(updates), grupos_custo, list(tipos)))

conn.commit()

print(f"\n{'='*60}")
print(f"RESULTADO:")
print(f"  Produtos atualizados: {total_atualizados}")
print(f"  SKUs não encontrados no banco: {total_nao_encontrados}")
print(f"{'='*60}")

print(f"\n=== Produtos atualizados ({len(atualizados_lista)}) ===")
for sku_p, sku_b, tipo, n_campos, grupos, tipos in atualizados_lista:
    if sku_p != sku_b:
        print(f"  {sku_p} -> {sku_b} | grupos:{grupos} tipos:{tipos} [{n_campos} campos]")
    else:
        print(f"  {sku_p} | grupos:{grupos} tipos:{tipos} [{n_campos} campos]")

print(f"\n=== SKUs NÃO encontrados no banco ({len(nao_encontrados_lista)}) ===")
for sku in sorted(nao_encontrados_lista):
    print(f"  {sku}")

cursor.close()
conn.close()
