#!/usr/bin/env python3
"""
Copia os custos do BLAZE S para o BLAZE A, mapeando por número de barras e comprimento.
Padrão do nome: "BLAZE A/S <TIPO> <N>B <COMP>MM"
Ex: "BLAZE A IN 1B 575MM" → usa custo de "BLAZE S IN 1B 575MM"
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

# Campos de custo e markup a copiar
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

# Buscar todos os BLAZE A (sem custo)
cursor.execute(f"SELECT id, sku, produto, {', '.join(ALL_FIELDS)} FROM products WHERE familia = 'BLAZE' AND produto LIKE '%BLAZE A%'")
blaze_a = cursor.fetchall()

# Buscar todos os BLAZE S (com custo)
cursor.execute(f"SELECT id, sku, produto, {', '.join(ALL_FIELDS)} FROM products WHERE familia = 'BLAZE' AND produto LIKE '%BLAZE S%'")
blaze_s = cursor.fetchall()

def extrair_chave(nome):
    """Extrai tipo + barras + comprimento do nome do produto.
    Ex: 'BLAZE S IN 1B 575MM' → ('IN', '1B', '575MM')
    Ex: 'BLAZE A ML 3.4B 1945MM' → ('ML', '3.4B', '1945MM')
    """
    # Remove prefixo BLAZE A/S
    nome_clean = re.sub(r'^BLAZE [AS]\s+', '', nome.strip())
    # Extrai partes: tipo (IN/ML/IF/etc), barras (NB ou N.NB), comprimento (NNNMM)
    parts = nome_clean.split()
    if len(parts) >= 3:
        tipo = parts[0]
        barras = parts[1]
        comp = parts[2]
        return (tipo, barras, comp)
    return None

# Montar dicionário de BLAZE S por chave
blaze_s_dict = {}
for s in blaze_s:
    chave = extrair_chave(s['produto'])
    if chave:
        blaze_s_dict[chave] = s

print(f"BLAZE A encontrados: {len(blaze_a)}")
print(f"BLAZE S encontrados: {len(blaze_s)}")
print()

atualizados = 0
nao_encontrados = []

for a in blaze_a:
    chave = extrair_chave(a['produto'])
    if not chave:
        print(f"  [SKIP] Não conseguiu extrair chave de: {a['produto']}")
        continue
    
    s = blaze_s_dict.get(chave)
    if not s:
        nao_encontrados.append((a['produto'], chave))
        continue
    
    # Montar update com todos os campos de custo e markup do BLAZE S equivalente
    update = {}
    for field in ALL_FIELDS:
        val = s.get(field)
        if val is not None:
            update[field] = str(val)
    
    if update:
        set_clause = ', '.join([f"`{k}` = %s" for k in update.keys()])
        cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s",
                       list(update.values()) + [a['id']])
        print(f"  [OK] {a['produto']:<50} ← {s['produto']:<50} custo={s['custoCorpoOnoff220v']}")
        atualizados += 1

conn.commit()
conn.close()

print(f"\n{'='*80}")
print(f"Atualizados: {atualizados}")
if nao_encontrados:
    print(f"\nNão encontrados ({len(nao_encontrados)}):")
    for nome, chave in nao_encontrados:
        print(f"  {nome} (chave: {chave})")
