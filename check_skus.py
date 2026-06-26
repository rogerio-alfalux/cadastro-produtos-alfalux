import json, re, mysql.connector
with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()
conn = mysql.connector.connect(host=host, port=int(port), user=user, password=password, database=dbname, ssl_disabled=False)
cursor = conn.cursor(dictionary=True)
for pat in ['%2142%', '%2660%', '%1027%']:
    cursor.execute(f"SELECT id, sku, descricao, custoCorpoOnoff220v FROM products WHERE sku LIKE '{pat}'")
    rows = cursor.fetchall()
    print(f"\nSKUs com padrão {pat}:")
    for r in rows:
        print(f"  id={r['id']} sku={r['sku']} custo={r['custoCorpoOnoff220v']} | {r['descricao']}")
conn.close()
