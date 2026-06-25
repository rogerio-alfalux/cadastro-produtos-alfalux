#!/usr/bin/env python3
"""
Substitui os últimos modelos de driver antigos pelo modelo oficial cadastrado em Componentes,
usando os códigos EQ fornecidos pelo usuário.

Mapeamentos:
  PHILIPS XITANIUM 65W 250MA  -> EQ00348
  LIFUD 60W 250MA             -> EQ00348
  LIFUD 60W 350MA             -> EQ00582
  LIFUD 30W 700MA LF/GIF030ES0700H 220V -> EQ00352
  PHILIPS XITANIUM 44W 250MA  -> EQ00396
  LIFUD 40W 250MA             -> EQ00396
"""

import mysql.connector
import json
import re

# Carregar credenciais
with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)

db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()

conn = mysql.connector.connect(
    host=host, port=int(port), user=user, password=password,
    database=dbname, ssl_disabled=False
)
cursor = conn.cursor(dictionary=True)

# Mapeamento: modelo antigo -> código EQ
MAPEAMENTOS = {
    'PHILIPS XITANIUM 65W 250MA':           'EQ00348',
    'LIFUD 60W 250MA':                       'EQ00348',
    'LIFUD 60W 350MA':                       'EQ00582',
    'LIFUD 30W 700MA LF/GIF030ES0700H 220V': 'EQ00352',
    'PHILIPS XITANIUM 44W 250MA':            'EQ00396',
    'LIFUD 40W 250MA':                       'EQ00396',
}

# Buscar modelo oficial e custo para cada código EQ
print("Buscando modelos oficiais na tabela components...")
eq_info = {}
for eq in set(MAPEAMENTOS.values()):
    cursor.execute(
        'SELECT modelo, custoDriver FROM components WHERE codigo = %s LIMIT 1',
        (eq,)
    )
    row = cursor.fetchone()
    if row:
        eq_info[eq] = {
            'modelo': row['modelo'].strip(),
            'custo': row['custoDriver']
        }
        print(f"  {eq} -> modelo: '{row['modelo']}', custo: {row['custoDriver']}")
    else:
        print(f"  AVISO: {eq} não encontrado em components!")

# Campos de driver e seus campos de custo correspondentes
DRIVER_COST_MAP = {
    'driverOnoff220':       'custoDriverOnoff220',
    'driverOnoffBivolt':    'custoDriverOnoffBivolt',
    'driverDim110v':        'custoDriverDim110v',
    'driverDimDali':        'custoDriverDimDali',
    'driverDimTriac110v':   'custoDriverDimTriac110v',
    'driverDimTriac220v':   'custoDriverDimTriac220v',
    'driverOnoff220Extra':      'custoDriverOnoff220',
    'driverOnoffBivoltExtra':   'custoDriverOnoffBivolt',
    'driverDim110vExtra':       'custoDriverDim110v',
    'driverDimDaliExtra':       'custoDriverDimDali',
    'driverDimTriac110vExtra':  'custoDriverDimTriac110v',
    'driverDimTriac220vExtra':  'custoDriverDimTriac220v',
}

DRIVER_FIELDS = list(DRIVER_COST_MAP.keys())

# Buscar todos os produtos
fields_sql = ', '.join(['id', 'sku'] + DRIVER_FIELDS)
cursor.execute(f'SELECT {fields_sql} FROM products')
rows = cursor.fetchall()

total_produtos = 0
total_campos = 0

for row in rows:
    updates = {}
    for field in DRIVER_FIELDS:
        val = row.get(field)
        if not val or not val.strip():
            continue
        vs = val.strip()
        if vs in MAPEAMENTOS:
            eq = MAPEAMENTOS[vs]
            if eq in eq_info:
                novo_modelo = eq_info[eq]['modelo']
                novo_custo = eq_info[eq]['custo']
                updates[field] = novo_modelo
                # Atualizar custo correspondente (apenas para campos não-Extra,
                # ou para Extra que compartilham o mesmo campo de custo)
                cost_field = DRIVER_COST_MAP[field]
                # Só atualizar custo se o campo de custo não foi já atualizado
                # por um campo principal (evitar sobrescrever com valor do Extra)
                if cost_field not in updates:
                    updates[cost_field] = novo_custo

    if updates:
        set_clauses = ', '.join([f'`{k}` = %s' for k in updates.keys()])
        values = list(updates.values()) + [row['id']]
        cursor.execute(
            f'UPDATE products SET {set_clauses} WHERE id = %s',
            values
        )
        total_produtos += 1
        total_campos += len([k for k in updates.keys() if not k.startswith('custo')])

conn.commit()
print(f"\nConcluído!")
print(f"  Produtos atualizados: {total_produtos}")
print(f"  Campos de driver substituídos: {total_campos}")

# Verificação final
print("\nVerificando se ainda restam drivers não-oficiais...")
cursor.execute(
    'SELECT modelo, codigo FROM components WHERE tipo IN '
    '("DRIVER_ONOFF_220","DRIVER_ONOFF_BIVOLT","DRIVER_DIM_110V","DRIVER_DIM_DALI","DRIVER_DIM_TRIAC_110V","DRIVER_DIM_TRIAC_220V") '
    'AND codigo IS NOT NULL'
)
oficiais = {r['modelo'].strip() for r in cursor.fetchall()}

IGNORAR = {
    'NÃO APLICÁVEL', 'NAO APLICAVEL', 'N/A', 'NÃO TEM OPÇÃO BIVOLT',
    'FORA DO LIMITE (6.0B) — CONSULTAR ENGENHARIA',
    'N/A — STRIPLINE: BARRAS INTEIRAS APENAS'
}

cursor.execute(f'SELECT {fields_sql} FROM products')
rows2 = cursor.fetchall()
nao_oficiais = {}
for r in rows2:
    for f in DRIVER_FIELDS:
        v = r.get(f)
        if not v or not v.strip():
            continue
        vs = v.strip()
        if vs.upper() in IGNORAR:
            continue
        if vs.startswith('[{') or vs == '[]':
            continue
        eq = re.search(r'\(?(EQ\d{5})\)?', vs, re.IGNORECASE)
        if eq:
            continue
        if vs not in oficiais:
            nao_oficiais[vs] = nao_oficiais.get(vs, 0) + 1

if nao_oficiais:
    print(f"  Ainda restam {len(nao_oficiais)} modelos não-oficiais:")
    for modelo, count in sorted(nao_oficiais.items(), key=lambda x: -x[1]):
        print(f"    [{count:3d}x] {modelo}")
else:
    print("  Nenhum driver não-oficial encontrado. Todos os drivers estão normalizados!")

cursor.close()
conn.close()
