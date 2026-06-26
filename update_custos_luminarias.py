#!/usr/bin/env python3
"""
Atualiza custos e markups de luminárias a partir da planilha TabelavendasLuminárias25.06.26final.xlsx.

Colunas da planilha:
  Col 0: Descrição (contém SKU + descrição, separados por " - ")
  Col 1: CUSTO LUMINÁRIA
  Col 2: MKP PADRÃO
  Col 3: MKP MÍNIMO
  Col 6: TIPO DRIVER (ON-OFF ou DIM)

Regras:
  - SKU é a parte antes do primeiro " - " na coluna de descrição
  - O custo da luminária é o mesmo para todos os tipos de driver
  - Markups (padrão e mínimo) são da luminária, não do driver
  - D1/D2 na planilha corresponde a "D1 + D2" no banco (campo custoCorpoD1D2 etc.)
  - Tipo ON-OFF -> campos Onoff220v e OnoffBivolt
  - Tipo DIM -> campos Dim110v, DimDali, DimTriac110v, DimTriac220v
  - Quando há ambos ON-OFF e DIM para o mesmo SKU, todos os campos são preenchidos

Mapeamento de campos no banco:
  custoCorpoOnoff220v, custoCorpoBivolt, custoCorpoDim110v, custoCorpoDimDali,
  custoCorpoDimTriac110v, custoCorpoDimTriac220v (para D1 ou D2 simples)
  custoCorpoD1D2Onoff220v, custoCorpoD1D2Bivolt, custoCorpoD1D2Dim110v, custoCorpoD1D2DimDali,
  custoCorpoD1D2DimTriac110v, custoCorpoD1D2DimTriac220v (para D1/D2)

  mkpPadraoOnoff220v, mkpMinimoOnoff220v, mkpPadraoOnoffBivolt, mkpMinimoOnoffBivolt,
  mkpPadraoDim110v, mkpMinimoDim110v, mkpPadraoDimDali, mkpMinimoDimDali,
  mkpPadraoDimTriac110v, mkpMinimoDimTriac110v, mkpPadraoDimTriac220v, mkpMinimoDimTriac220v
  (e versões D1D2)
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
    # 1. Match direto
    if sku in db_sku_to_id:
        return db_sku_to_id[sku], sku, 'direto'
    # 2. Por sufixo (troca de prefixo)
    m2 = re.match(r'^([A-Z]{3,4})(-?.+)$', sku)
    if m2:
        sufixo = m2.group(2)
        matches = db_suffix_to_skus.get(sufixo, [])
        if len(matches) == 1:
            return matches[0][1], matches[0][0], f'sufixo({m2.group(1)}->{matches[0][0][:3]})'
        elif len(matches) > 1:
            # Preferir match com mesmo prefixo
            for db_sku, pid in matches:
                if db_sku.startswith(m2.group(1)):
                    return pid, db_sku, 'sufixo-mesmo-prefixo'
            return matches[0][1], matches[0][0], f'sufixo-multi({len(matches)})'
    return None, None, 'não encontrado'

# ─── Carregar planilha ───────────────────────────────────────────────────────
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

# Estrutura: por SKU da planilha, coletar dados por tipo de driver
# planilha_data[sku_planilha] = {
#   'custo': float,
#   'mkp_padrao': float,
#   'mkp_minimo': float,
#   'tipos': set of 'ON-OFF' | 'DIM',
#   'desc_completa': str,
#   'is_d1d2': bool,
#   'is_d1': bool,
#   'is_d2': bool,
# }
planilha_data = {}

for row in ws.iter_rows(min_row=2, values_only=True):
    if not row[0]:
        continue
    desc = str(row[0]).strip()
    custo = row[1]
    mkp_padrao = row[2]
    mkp_minimo = row[3]
    tipo_driver = str(row[6]).strip().upper() if row[6] else ''

    # Extrair SKU
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
            'desc_completa': desc,
            'is_d1d2': is_d1d2,
            'is_d1': is_d1,
            'is_d2': is_d2,
        }
    else:
        # Atualizar tipos e flags
        entry = planilha_data[sku_planilha]
        if is_d1d2:
            entry['is_d1d2'] = True
        if is_d1:
            entry['is_d1'] = True
        if is_d2:
            entry['is_d2'] = True

    if tipo_driver in ('ON-OFF', 'DIM'):
        planilha_data[sku_planilha]['tipos'].add(tipo_driver)

wb.close()

print(f"SKUs únicos na planilha: {len(planilha_data)}")

# ─── Verificar quais campos existem na tabela products ───────────────────────
cursor.execute("SHOW COLUMNS FROM products")
colunas_banco = {r['Field'] for r in cursor.fetchall()}

# Campos de custo do corpo disponíveis
CAMPOS_CUSTO = {
    'D1_onoff220':    'custoCorpoOnoff220v',
    'D1_bivolt':      'custoCorpoBivolt',
    'D1_dim110v':     'custoCorpoDim110v',
    'D1_dimDali':     'custoCorpoDimDali',
    'D1_dimTriac110': 'custoCorpoDimTriac110v',
    'D1_dimTriac220': 'custoCorpoDimTriac220v',
    'D2_onoff220':    'custoCorpoD1D2Onoff220v',
    'D2_bivolt':      'custoCorpoD1D2Bivolt',
    'D2_dim110v':     'custoCorpoD1D2Dim110v',
    'D2_dimDali':     'custoCorpoD1D2DimDali',
    'D2_dimTriac110': 'custoCorpoD1D2DimTriac110v',
    'D2_dimTriac220': 'custoCorpoD1D2DimTriac220v',
}

CAMPOS_MKP_PADRAO = {
    'D1_onoff220':    'mkpPadraoOnoff220v',
    'D1_bivolt':      'mkpPadraoOnoffBivolt',
    'D1_dim110v':     'mkpPadraoDim110v',
    'D1_dimDali':     'mkpPadraoDimDali',
    'D1_dimTriac110': 'mkpPadraoDimTriac110v',
    'D1_dimTriac220': 'mkpPadraoDimTriac220v',
    'D2_onoff220':    'mkpPadraoD1D2Onoff220v',
    'D2_bivolt':      'mkpPadraoD1D2Bivolt',
    'D2_dim110v':     'mkpPadraoD1D2Dim110v',
    'D2_dimDali':     'mkpPadraoD1D2DimDali',
    'D2_dimTriac110': 'mkpPadraoD1D2DimTriac110v',
    'D2_dimTriac220': 'mkpPadraoD1D2DimTriac220v',
}

CAMPOS_MKP_MINIMO = {
    'D1_onoff220':    'mkpMinimoOnoff220v',
    'D1_bivolt':      'mkpMinimoOnoffBivolt',
    'D1_dim110v':     'mkpMinimoDim110v',
    'D1_dimDali':     'mkpMinimoDimDali',
    'D1_dimTriac110': 'mkpMinimoDimTriac110v',
    'D1_dimTriac220': 'mkpMinimoDimTriac220v',
    'D2_onoff220':    'mkpMinimoD1D2Onoff220v',
    'D2_bivolt':      'mkpMinimoD1D2Bivolt',
    'D2_dim110v':     'mkpMinimoD1D2Dim110v',
    'D2_dimDali':     'mkpMinimoD1D2DimDali',
    'D2_dimTriac110': 'mkpMinimoD1D2DimTriac110v',
    'D2_dimTriac220': 'mkpMinimoD1D2DimTriac220v',
}

# Verificar quais campos D1D2 existem no banco
campos_d1d2_existem = all(v in colunas_banco for v in CAMPOS_CUSTO.values() if 'D1D2' in v)
print(f"\nCampos D1D2 existem no banco: {campos_d1d2_existem}")
if not campos_d1d2_existem:
    campos_faltando = [v for v in CAMPOS_CUSTO.values() if 'D1D2' in v and v not in colunas_banco]
    print(f"Campos faltando: {campos_faltando[:5]}...")

# ─── Processar e atualizar ───────────────────────────────────────────────────
total_atualizados = 0
total_nao_encontrados = 0
nao_encontrados_lista = []
atualizados_lista = []

for sku_planilha, dados in planilha_data.items():
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
    # Se D1/D2 -> prefixo D2 (campos D1D2)
    # Se D1 ou sem marcação -> prefixo D1 (campos normais)
    # Se ambos -> atualizar ambos
    grupos = []
    if is_d1d2 and campos_d1d2_existem:
        grupos.append('D2')
    if not is_d1d2 or is_d1:
        grupos.append('D1')

    if not grupos:
        grupos = ['D1']  # padrão

    updates = {}
    for grupo in grupos:
        # Determinar quais tipos de driver atualizar
        if 'ON-OFF' in tipos or not tipos:
            for key in ['onoff220', 'bivolt']:
                campo_custo = CAMPOS_CUSTO.get(f'{grupo}_{key}')
                campo_mkp_p = CAMPOS_MKP_PADRAO.get(f'{grupo}_{key}')
                campo_mkp_m = CAMPOS_MKP_MINIMO.get(f'{grupo}_{key}')
                if campo_custo and campo_custo in colunas_banco and custo is not None:
                    updates[campo_custo] = custo
                if campo_mkp_p and campo_mkp_p in colunas_banco and mkp_padrao is not None:
                    updates[campo_mkp_p] = mkp_padrao
                if campo_mkp_m and campo_mkp_m in colunas_banco and mkp_minimo is not None:
                    updates[campo_mkp_m] = mkp_minimo

        if 'DIM' in tipos or not tipos:
            for key in ['dim110v', 'dimDali', 'dimTriac110', 'dimTriac220']:
                campo_custo = CAMPOS_CUSTO.get(f'{grupo}_{key}')
                campo_mkp_p = CAMPOS_MKP_PADRAO.get(f'{grupo}_{key}')
                campo_mkp_m = CAMPOS_MKP_MINIMO.get(f'{grupo}_{key}')
                if campo_custo and campo_custo in colunas_banco and custo is not None:
                    updates[campo_custo] = custo
                if campo_mkp_p and campo_mkp_p in colunas_banco and mkp_padrao is not None:
                    updates[campo_mkp_p] = mkp_padrao
                if campo_mkp_m and campo_mkp_m in colunas_banco and mkp_minimo is not None:
                    updates[campo_mkp_m] = mkp_minimo

    if updates:
        set_clauses = ', '.join([f'`{k}` = %s' for k in updates.keys()])
        values = list(updates.values()) + [pid]
        cursor.execute(f'UPDATE products SET {set_clauses} WHERE id = %s', values)
        total_atualizados += 1
        atualizados_lista.append((sku_planilha, db_sku, tipo_match, len(updates)))

conn.commit()

print(f"\n{'='*60}")
print(f"RESULTADO:")
print(f"  Produtos atualizados: {total_atualizados}")
print(f"  SKUs não encontrados no banco: {total_nao_encontrados}")
print(f"{'='*60}")

print(f"\n=== Produtos atualizados ({len(atualizados_lista)}) ===")
for sku_p, sku_b, tipo, n_campos in atualizados_lista:
    if sku_p != sku_b:
        print(f"  {sku_p} -> {sku_b} ({tipo}) [{n_campos} campos]")
    else:
        print(f"  {sku_p} [{n_campos} campos]")

print(f"\n=== SKUs NÃO encontrados no banco ({len(nao_encontrados_lista)}) ===")
for sku in sorted(nao_encontrados_lista):
    print(f"  {sku}")

cursor.close()
conn.close()
