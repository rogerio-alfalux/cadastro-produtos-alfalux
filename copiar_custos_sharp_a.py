#!/usr/bin/env python3
"""
Copia os custos do SHARP P para o SHARP A,
mapeando por tipo (IN/IF/ML) e comprimento equivalente.
SHARP não tem D1+D2, então apenas copia os campos D1.
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
MKP_FIELDS = [
    'mkpPadraoOnoff220v', 'mkpPadraoOnoffBivolt', 'mkpPadraoDim110v',
    'mkpPadraoDimDali', 'mkpPadraoDimTriac110v', 'mkpPadraoDimTriac220v',
    'mkpMinimoOnoff220v', 'mkpMinimoOnoffBivolt', 'mkpMinimoDim110v',
    'mkpMinimoDimDali', 'mkpMinimoDimTriac110v', 'mkpMinimoDimTriac220v',
]
ALL_FIELDS = CUSTO_FIELDS + MKP_FIELDS

def extrair_info(nome):
    """Extrai tipo e comprimento em MM.
    Ex: 'SHARP P IN 1B 575MM' → ('IN', 575)
    Ex: 'SHARP A ML 3B 1695MM' → ('ML', 1695)
    """
    nome_clean = re.sub(r'^SHARP [PA]\s+', '', nome.strip())
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

# Buscar SHARP P com custo
cursor.execute(f"SELECT id, sku, produto, {', '.join(ALL_FIELDS)} FROM products WHERE familia = 'SHARP' AND produto LIKE '%SHARP P%' AND custoCorpoOnoff220v IS NOT NULL")
fonte = cursor.fetchall()

# Buscar SHARP A
cursor.execute(f"SELECT id, sku, produto FROM products WHERE familia = 'SHARP' AND produto LIKE '%SHARP A%'")
destino = cursor.fetchall()

print(f"SHARP P com custo: {len(fonte)}")
print(f"SHARP A para preencher: {len(destino)}")

# Organizar por tipo → lista de (comprimento, row)
fonte_por_tipo = {}
for p in fonte:
    tipo, comp = extrair_info(p['produto'])
    if tipo and comp:
        if tipo not in fonte_por_tipo:
            fonte_por_tipo[tipo] = []
        fonte_por_tipo[tipo].append((comp, p))

for tipo in fonte_por_tipo:
    fonte_por_tipo[tipo].sort(key=lambda x: x[0])

print(f"Tipos disponíveis no SHARP P: {list(fonte_por_tipo.keys())}")

def interpolar(tipo, comp_alvo, field):
    pontos = fonte_por_tipo.get(tipo, [])
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

for a in destino:
    tipo, comp = extrair_info(a['produto'])
    if not tipo or not comp:
        print(f"  [SKIP] Não extraiu info de: {a['produto']}")
        continue

    pontos = fonte_por_tipo.get(tipo, [])
    if not pontos:
        nao_encontrados.append(a['produto'])
        continue

    update = {}

    # Custos D1 por interpolação
    for field in CUSTO_FIELDS:
        val = interpolar(tipo, comp, field)
        if val is not None:
            update[field] = str(val)

    # Markups: pegar do mais próximo
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
        print(f"  [OK] {a['produto']:<55} custo={custo}")
        atualizados += 1

conn.commit()
conn.close()

print(f"\n{'='*80}")
print(f"Atualizados: {atualizados}/{len(destino)}")
if nao_encontrados:
    print(f"\nSem equivalente ({len(nao_encontrados)}):")
    for n in nao_encontrados:
        print(f"  {n}")
