#!/usr/bin/env python3
"""
Aplica a regra: mkp mínimo = MAX(2, mkp padrão - 1)
para todos os campos de markup em todos os produtos.
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

# Pares (mkp_padrao, mkp_minimo) para cada tipo de driver
PARES = [
    ('mkpPadraoOnoff220v',    'mkpMinimoOnoff220v'),
    ('mkpPadraoOnoffBivolt',  'mkpMinimoOnoffBivolt'),
    ('mkpPadraoDim110v',      'mkpMinimoDim110v'),
    ('mkpPadraoDimDali',      'mkpMinimoDimDali'),
    ('mkpPadraoDimTriac110v', 'mkpMinimoDimTriac110v'),
    ('mkpPadraoDimTriac220v', 'mkpMinimoDimTriac220v'),
]

# Buscar todos os produtos
cursor.execute("SELECT id, " + ", ".join(p for par in PARES for p in par) + " FROM products")
products = cursor.fetchall()

atualizados = 0
total_campos = 0

for prod in products:
    update = {}
    for padrao_f, minimo_f in PARES:
        val_padrao = prod.get(padrao_f)
        if val_padrao is None:
            continue
        try:
            mkp_padrao = float(val_padrao)
        except (ValueError, TypeError):
            continue
        if mkp_padrao <= 0:
            continue
        # Regra: MAX(2, mkp_padrao - 1)
        novo_minimo = max(2.0, mkp_padrao - 1.0)
        # Arredondar para 4 casas
        novo_minimo = round(novo_minimo, 4)
        update[minimo_f] = str(novo_minimo)
        total_campos += 1

    if update:
        set_clause = ', '.join([f"`{k}` = %s" for k in update.keys()])
        cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s",
                       list(update.values()) + [prod['id']])
        atualizados += 1

conn.commit()
conn.close()

print(f"Produtos atualizados: {atualizados}")
print(f"Campos de mkp mínimo recalculados: {total_campos}")
print("Regra aplicada: mkp mínimo = MAX(2, mkp padrão - 1)")
