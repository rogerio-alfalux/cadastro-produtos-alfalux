#!/usr/bin/env python3
"""
Para os 7 BLAZE A sem equivalente direto no BLAZE S,
calcula o custo por interpolação linear usando o comprimento em MM.
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

# Buscar todos os BLAZE S com custo
cursor.execute(f"SELECT id, sku, produto, {', '.join(ALL_FIELDS)} FROM products WHERE familia = 'BLAZE' AND produto LIKE '%BLAZE S%' AND custoCorpoOnoff220v IS NOT NULL")
blaze_s = cursor.fetchall()

def extrair_info(nome):
    """Extrai tipo e comprimento em MM."""
    nome_clean = re.sub(r'^BLAZE [AS]\s+', '', nome.strip())
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

# Organizar BLAZE S por tipo → lista de (comprimento, row)
blaze_s_por_tipo = {}
for s in blaze_s:
    tipo, comp = extrair_info(s['produto'])
    if tipo and comp:
        if tipo not in blaze_s_por_tipo:
            blaze_s_por_tipo[tipo] = []
        blaze_s_por_tipo[tipo].append((comp, s))

# Ordenar por comprimento
for tipo in blaze_s_por_tipo:
    blaze_s_por_tipo[tipo].sort(key=lambda x: x[0])

def interpolar(tipo, comp_alvo, field):
    """Interpola linearmente o valor de um campo para um dado comprimento."""
    pontos = blaze_s_por_tipo.get(tipo, [])
    if not pontos:
        return None
    
    # Encontrar os dois pontos mais próximos
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
    
    # Interpolação linear
    comp1, val1 = menor
    comp2, val2 = maior
    if comp2 == comp1:
        return val1
    ratio = (comp_alvo - comp1) / (comp2 - comp1)
    return round(val1 + ratio * (val2 - val1), 4)

# Os 7 BLAZE A sem equivalente
pendentes = [
    'BLAZE A IN 1.5B 885MM',
    'BLAZE A IN 2.6B 1510MM',
    'BLAZE A IN 3.2B 1825MM',
    'BLAZE A IF 5.6B 3200MM',
    'BLAZE A ML 4.3B 2445MM',
    'BLAZE A ML 5.6B 3195MM',
    'BLAZE A ML 5.7B 3255MM',
]

cursor.execute(f"SELECT id, sku, produto FROM products WHERE familia = 'BLAZE' AND produto LIKE '%BLAZE A%'")
blaze_a_all = {r['produto']: r for r in cursor.fetchall()}

atualizados = 0
for nome in pendentes:
    row = blaze_a_all.get(nome)
    if not row:
        print(f"  [ERRO] Produto não encontrado: {nome}")
        continue
    
    tipo, comp = extrair_info(nome)
    if not tipo or not comp:
        print(f"  [ERRO] Não extraiu info de: {nome}")
        continue
    
    update = {}
    for field in CUSTO_FIELDS:
        val = interpolar(tipo, comp, field)
        if val is not None:
            update[field] = str(val)
    
    # Para os mkp, usar o mesmo valor do BLAZE S mais próximo (não interpolar)
    pontos = blaze_s_por_tipo.get(tipo, [])
    if pontos:
        # Pegar o mais próximo por comprimento
        mais_proximo = min(pontos, key=lambda x: abs(x[0] - comp))
        for field in MKP_FIELDS:
            val = mais_proximo[1].get(field)
            if val is not None:
                update[field] = str(val)
    
    if update:
        set_clause = ', '.join([f"`{k}` = %s" for k in update.keys()])
        cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s",
                       list(update.values()) + [row['id']])
        custo = update.get('custoCorpoOnoff220v', '?')
        print(f"  [OK] {nome:<50} custo interpolado={custo}")
        atualizados += 1

conn.commit()
conn.close()
print(f"\nAtualizados: {atualizados}/7")
