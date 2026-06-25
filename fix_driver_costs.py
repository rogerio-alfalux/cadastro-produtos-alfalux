import mysql.connector, json, re

with open('.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()

conn = mysql.connector.connect(
    host=host, port=int(port), user=user, password=password,
    database=dbname, ssl_disabled=False
)
cursor = conn.cursor(dictionary=True)

# Mapeamento: campo driver no produto -> campo custo no produto -> tipo no components
DRIVER_MAPPING = [
    ('driverOnoff220',    'custoDriverOnoff220',    'DRIVER_ONOFF_220',      'driverOnoff220Extra'),
    ('driverOnoffBivolt', 'custoDriverOnoffBivolt', 'DRIVER_ONOFF_BIVOLT',   'driverOnoffBivoltExtra'),
    ('driverDim110v',     'custoDriverDim110v',     'DRIVER_DIM_110V',       'driverDim110vExtra'),
    ('driverDimDali',     'custoDriverDimDali',     'DRIVER_DIM_DALI',       'driverDimDaliExtra'),
    ('driverDimTriac110v','custoDriverDimTriac110v','DRIVER_DIM_TRIAC_110V', 'driverDimTriac110vExtra'),
    ('driverDimTriac220v','custoDriverDimTriac220v','DRIVER_DIM_TRIAC_220V', 'driverDimTriac220vExtra'),
]

# Buscar todos os componentes do tipo driver com custo
print("Carregando componentes (drivers)...")
cursor.execute("""
    SELECT id, tipo, modelo, custo, custoDriver
    FROM components
    WHERE tipo IN ('DRIVER_ONOFF_220','DRIVER_ONOFF_BIVOLT','DRIVER_DIM_110V',
                   'DRIVER_DIM_DALI','DRIVER_DIM_TRIAC_110V','DRIVER_DIM_TRIAC_220V')
""")
components = cursor.fetchall()
print(f"  Total de drivers cadastrados: {len(components)}")

# Indexar por (tipo, modelo) -> custo
driver_cost_map = {}
for c in components:
    tipo = c['tipo']
    modelo = c['modelo']
    # Usar custoDriver se disponível, senão custo
    custo = c['custoDriver'] if c['custoDriver'] is not None else c['custo']
    if custo is not None and float(custo) > 0:
        driver_cost_map[(tipo, modelo)] = float(custo)

print(f"  Drivers com custo: {len(driver_cost_map)}")

# Buscar todos os produtos
print("\nCarregando produtos...")
fields = ['id', 'sku'] + [f for trio in DRIVER_MAPPING for f in [trio[0], trio[1], trio[3]]]
cursor.execute(f"SELECT {', '.join(fields)} FROM products")
products = cursor.fetchall()
print(f"  Total de produtos: {len(products)}")

# Varredura: encontrar produtos com driver associado mas sem custo
updates = []
sem_custo_driver = []  # drivers associados mas sem custo na tabela components

for prod in products:
    prod_updates = {}
    
    for driver_field, custo_field, tipo_comp, extra_field in DRIVER_MAPPING:
        modelo = prod.get(driver_field)
        custo_atual = prod.get(custo_field)
        
        if not modelo or modelo.strip() == '':
            continue
        
        # Tem driver associado mas sem custo
        if custo_atual is None or float(custo_atual) == 0:
            # Buscar custo na tabela de componentes
            chave = (tipo_comp, modelo)
            if chave in driver_cost_map:
                prod_updates[custo_field] = driver_cost_map[chave]
            else:
                # Tentar busca parcial (modelo pode ter variação de espaços)
                modelo_strip = modelo.strip()
                found = None
                for (t, m), custo in driver_cost_map.items():
                    if t == tipo_comp and m.strip() == modelo_strip:
                        found = custo
                        break
                if found:
                    prod_updates[custo_field] = found
                else:
                    sem_custo_driver.append({
                        'sku': prod['sku'],
                        'tipo': tipo_comp,
                        'modelo': modelo,
                        'campo_custo': custo_field
                    })
        
        # Verificar também o extra driver
        extra_modelo = prod.get(extra_field)
        if extra_modelo and extra_modelo.strip():
            # O custo extra é somado ao principal — não há campo separado por enquanto
            # Apenas reportar
            pass
    
    if prod_updates:
        updates.append((prod['id'], prod['sku'], prod_updates))

print(f"\nProdutos a atualizar (driver com custo encontrado): {len(updates)}")
print(f"Produtos com driver sem custo na tabela: {len(sem_custo_driver)}")

# Mostrar exemplos
if updates:
    print("\nExemplos de atualizações:")
    for prod_id, sku, upd in updates[:10]:
        print(f"  {sku}: {upd}")

if sem_custo_driver:
    print(f"\nDrivers associados SEM custo cadastrado ({len(sem_custo_driver)} casos):")
    # Agrupar por modelo de driver
    from collections import Counter
    modelos_sem_custo = Counter(f"{d['tipo']} | {d['modelo']}" for d in sem_custo_driver)
    for modelo, count in modelos_sem_custo.most_common(20):
        print(f"  [{count}x] {modelo}")

# Executar os UPDATEs
print("\nExecutando UPDATEs...")
update_cursor = conn.cursor()
success = 0
errors = 0

for prod_id, sku, upd in updates:
    set_parts = []
    vals = []
    for field, val in upd.items():
        set_parts.append(f"{field} = %s")
        vals.append(val)
    vals.append(prod_id)
    sql = f"UPDATE products SET {', '.join(set_parts)} WHERE id = %s"
    try:
        update_cursor.execute(sql, vals)
        success += 1
    except Exception as e:
        errors += 1
        print(f"  ERRO {sku}: {e}")

conn.commit()
print(f"\n=== Resultado ===")
print(f"Sucesso: {success} | Erros: {errors}")

cursor.close()
update_cursor.close()
conn.close()
