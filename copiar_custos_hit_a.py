#!/usr/bin/env python3
"""
Copia os custos do HIT P para o HIT A por tipo e comprimento equivalente.
Também iguala D1+D2 = D1 para todos os HIT A.
"""
import json, re
import mysql.connector

with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()
conn = mysql.connector.connect(host=host, port=int(port), user=user, password=password,
                                database=dbname, ssl_disabled=False)
cursor = conn.cursor(dictionary=True)

CUSTO_FIELDS = [
    'custoCorpoOnoff220v', 'custoCorpoOnoffBivolt', 'custoCorpoDim110v',
    'custoCorpoDimDali', 'custoCorpoDimTriac110v', 'custoCorpoDimTriac220v',
]
CUSTO_D1D2_FIELDS = [
    'custoCorpoOnoff220vD1D2', 'custoCorpoOnoffBivoltD1D2', 'custoCorpoDim110vD1D2',
    'custoCorpoDimDaliD1D2', 'custoCorpoDimTriac110vD1D2', 'custoCorpoDimTriac220vD1D2',
]
MKP_FIELDS = [
    'mkpPadraoOnoff220v', 'mkpPadraoOnoffBivolt', 'mkpPadraoDim110v',
    'mkpPadraoDimDali', 'mkpPadraoDimTriac110v', 'mkpPadraoDimTriac220v',
    'mkpMinimoOnoff220v', 'mkpMinimoOnoffBivolt', 'mkpMinimoDim110v',
    'mkpMinimoDimDali', 'mkpMinimoDimTriac110v', 'mkpMinimoDimTriac220v',
]
ALL_FIELDS = CUSTO_FIELDS + MKP_FIELDS

def extrair_info(nome):
    """Extrai tipo e comprimento em MM do nome do produto HIT.
    Ex: 'HIT P IN 1B 575MM' → ('IN', 575)
    Ex: 'HIT A IF 3.3B 1885MM' → ('IF', 1885)
    """
    # Remove prefixo HIT P/A
    nome_clean = re.sub(r'^HIT [PA]\s+', '', nome.strip())
    parts = nome_clean.split()
    if len(parts) >= 3:
        tipo = parts[0]
        comp_str = parts[2].replace('MM', '')
        try:
            comp = int(comp_str)
            return tipo, comp
        except:
            pass
    return None, None

# Buscar HIT P com custo
cursor.execute(f"SELECT id, sku, produto, {', '.join(ALL_FIELDS)} FROM products WHERE familia = 'HIT' AND produto LIKE '%HIT P%' AND custoCorpoOnoff220v IS NOT NULL")
hit_p = cursor.fetchall()

# Buscar HIT A (sem custo)
cursor.execute(f"SELECT id, sku, produto FROM products WHERE familia = 'HIT' AND produto LIKE '%HIT A%'")
hit_a = cursor.fetchall()

print(f"HIT P com custo: {len(hit_p)}")
print(f"HIT A para preencher: {len(hit_a)}")

# Organizar HIT P por tipo → lista de (comprimento, row)
hit_p_por_tipo = {}
for p in hit_p:
    tipo, comp = extrair_info(p['produto'])
    if tipo and comp:
        if tipo not in hit_p_por_tipo:
            hit_p_por_tipo[tipo] = []
        hit_p_por_tipo[tipo].append((comp, p))

for tipo in hit_p_por_tipo:
    hit_p_por_tipo[tipo].sort(key=lambda x: x[0])

def interpolar(tipo, comp_alvo, field):
    """Interpolação linear pelo comprimento."""
    pontos = hit_p_por_tipo.get(tipo, [])
    menor = None
    maior = None
    for comp, row in pontos:
        val = row.get(field)
        if val is None:
            continue
        try:
            val = float(val)
        except:
            continue
        if comp <= comp_alvo:
            menor = (comp, val)
        elif comp > comp_alvo and maior is None:
            maior = (comp, val)
    if menor is None and maior is None:
        return None
    if menor is None:
        return maior[1]
    if maior is None:
        return menor[1]
    comp1, val1 = menor
    comp2, val2 = maior
    if comp2 == comp1:
        return val1
    ratio = (comp_alvo - comp1) / (comp2 - comp1)
    return round(val1 + ratio * (val2 - val1), 4)

atualizados = 0
nao_encontrados = []

for a in hit_a:
    tipo, comp = extrair_info(a['produto'])
    if not tipo or not comp:
        print(f"  [SKIP] Não extraiu info de: {a['produto']}")
        continue

    pontos = hit_p_por_tipo.get(tipo, [])
    if not pontos:
        nao_encontrados.append(a['produto'])
        continue

    update = {}

    # Custos D1 por interpolação
    for field in CUSTO_FIELDS:
        val = interpolar(tipo, comp, field)
        if val is not None:
            update[field] = str(val)

    # D1+D2 = mesmo valor que D1
    for d1_field, d1d2_field in zip(CUSTO_FIELDS, CUSTO_D1D2_FIELDS):
        if d1_field in update:
            update[d1d2_field] = update[d1_field]

    # Markups: pegar do HIT P mais próximo
    mais_proximo = min(pontos, key=lambda x: abs(x[0] - comp))
    for field in MKP_FIELDS:
        val = mais_proximo[1].get(field)
        if val is not None:
            update[field] = str(val)

    if update:
        set_clause = ', '.join([f"`{k}` = %s" for k in update.keys()])
        cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s",
                       list(update.values()) + [a['id']])
        custo = update.get('custoCorpoOnoff220v', '?')
        print(f"  [OK] {a['produto']:<50} custo={custo}")
        atualizados += 1

conn.commit()
conn.close()

print(f"\n{'='*80}")
print(f"Atualizados: {atualizados}/{len(hit_a)}")
if nao_encontrados:
    print(f"\nSem equivalente ({len(nao_encontrados)}):")
    for n in nao_encontrados:
        print(f"  {n}")
