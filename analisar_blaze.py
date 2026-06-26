#!/usr/bin/env python3
"""
Analisa produtos BLAZE A e BLAZE S para mapear custos equivalentes
por comprimento e número de barras.
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

# Buscar BLAZE A e BLAZE S
cursor.execute("""
    SELECT id, sku, produto, familia, 
           custoCorpoOnoff220v, custoCorpoOnoffBivolt, custoCorpoDim110v, custoCorpoDimDali,
           mkpPadraoOnoff220v, mkpMinimoOnoff220v
    FROM products 
    WHERE familia IN ('BLAZE A', 'BLAZE S')
    ORDER BY familia, produto
""")
rows = cursor.fetchall()
conn.close()

print(f"{'FAMÍLIA':<12} {'SKU':<30} {'PRODUTO':<45} {'CUSTO ON/OFF 220V'}")
print("-" * 120)
for r in rows:
    custo = r['custoCorpoOnoff220v']
    print(f"{r['familia']:<12} {r['sku']:<30} {r['produto']:<45} {custo}")
