import mysql.connector, json, re
from collections import defaultdict

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

# Carregar drivers oficiais
cursor.execute("""
    SELECT id, tipo, modelo, codigo, custo, custoDriver
    FROM components
    WHERE tipo IN ('DRIVER_ONOFF_220','DRIVER_ONOFF_BIVOLT','DRIVER_DIM_110V',
                   'DRIVER_DIM_DALI','DRIVER_DIM_TRIAC_110V','DRIVER_DIM_TRIAC_220V')
    AND codigo IS NOT NULL AND codigo != ''
""")
components = cursor.fetchall()

eq_to_oficial = {}
for c in components:
    codigo = c['codigo'].strip().upper()
    custo = float(c['custoDriver']) if c['custoDriver'] else (float(c['custo']) if c['custo'] else None)
    eq_to_oficial[codigo] = {'modelo': c['modelo'], 'custo': custo, 'tipo': c['tipo']}

# Também indexar por modelo (normalizado) para busca por nome
modelo_to_oficial = {}
for c in components:
    modelo_norm = c['modelo'].strip().upper()
    custo = float(c['custoDriver']) if c['custoDriver'] else (float(c['custo']) if c['custo'] else None)
    modelo_to_oficial[modelo_norm] = {'modelo': c['modelo'], 'custo': custo, 'tipo': c['tipo'], 'codigo': c['codigo']}

def extract_eq_code(texto):
    if not texto:
        return None
    m = re.search(r'\(?(EQ\d{5})\)?', texto, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return None

def resolve_driver(texto):
    """
    Dado um texto de driver (pode ser JSON ou string), retorna o modelo oficial.
    Retorna (modelo_oficial, custo) ou (texto_limpo, None) se não encontrar oficial.
    """
    if not texto or not texto.strip():
        return None, None
    
    texto_strip = texto.strip()
    
    # Caso 1: JSON serializado
    if texto_strip.startswith('[{'):
        try:
            arr = json.loads(texto_strip)
            if arr and isinstance(arr, list) and 'modelo' in arr[0]:
                modelo_json = arr[0]['modelo']
                # Tentar resolver o modelo do JSON
                eq = extract_eq_code(modelo_json)
                if eq and eq in eq_to_oficial:
                    of = eq_to_oficial[eq]
                    return of['modelo'], of['custo']
                # Buscar por nome exato
                modelo_norm = modelo_json.strip().upper()
                if modelo_norm in modelo_to_oficial:
                    of = modelo_to_oficial[modelo_norm]
                    return of['modelo'], of['custo']
                # Retornar o texto do JSON limpo
                return modelo_json, None
        except:
            pass
        return texto_strip, None
    
    # Caso 2: String normal com código EQ
    eq = extract_eq_code(texto_strip)
    if eq and eq in eq_to_oficial:
        of = eq_to_oficial[eq]
        return of['modelo'], of['custo']
    
    # Caso 3: String normal sem EQ — buscar por nome
    modelo_norm = texto_strip.upper()
    if modelo_norm in modelo_to_oficial:
        of = modelo_to_oficial[modelo_norm]
        return of['modelo'], of['custo']
    
    return texto_strip, None

# Campos de driver (modelo, custo associado)
DRIVER_FIELDS = [
    ('driverOnoff220',     'custoDriverOnoff220'),
    ('driverOnoffBivolt',  'custoDriverOnoffBivolt'),
    ('driverDim110v',      'custoDriverDim110v'),
    ('driverDimDali',      'custoDriverDimDali'),
    ('driverDimTriac110v', 'custoDriverDimTriac110v'),
    ('driverDimTriac220v', 'custoDriverDimTriac220v'),
    ('driverOnoff220Extra',     None),
    ('driverOnoffBivoltExtra',  None),
    ('driverDim110vExtra',      None),
    ('driverDimDaliExtra',      None),
    ('driverDimTriac110vExtra', None),
    ('driverDimTriac220vExtra', None),
]

# Buscar todos os produtos
all_fields = ['id', 'sku'] + [f[0] for f in DRIVER_FIELDS] + [f[1] for f in DRIVER_FIELDS if f[1]]
seen = set()
unique_fields = []
for f in all_fields:
    if f not in seen:
        seen.add(f)
        unique_fields.append(f)

cursor.execute(f"SELECT {', '.join(unique_fields)} FROM products")
products = cursor.fetchall()
print(f"Total de produtos: {len(products)}")

updates = []
substituicoes = defaultdict(int)

IGNORAR = {'NÃO APLICÁVEL', 'NAO APLICAVEL', 'N/A', 'NÃO TEM OPÇÃO BIVOLT',
           'FORA DO LIMITE (6.0B) — CONSULTAR ENGENHARIA',
           'N/A — STRIPLINE: BARRAS INTEIRAS APENAS'}

for prod in products:
    prod_updates = {}
    
    for driver_field, custo_field in DRIVER_FIELDS:
        modelo_atual = prod.get(driver_field)
        if not modelo_atual or not modelo_atual.strip():
            continue
        
        if modelo_atual.strip().upper() in IGNORAR:
            continue
        
        modelo_novo, custo_novo = resolve_driver(modelo_atual)
        
        if modelo_novo and modelo_novo.strip() != modelo_atual.strip():
            prod_updates[driver_field] = modelo_novo
            substituicoes[(modelo_atual[:40], modelo_novo[:40])] += 1
            if custo_field and custo_novo:
                prod_updates[custo_field] = custo_novo
        elif custo_field and custo_novo:
            # Modelo já correto, mas atualizar custo se nulo
            custo_atual = prod.get(custo_field)
            if custo_atual is None or float(custo_atual) == 0:
                prod_updates[custo_field] = custo_novo
    
    if prod_updates:
        updates.append((prod['id'], prod['sku'], prod_updates))

print(f"Produtos a atualizar: {len(updates)}")
print(f"\nSubstituições:")
for (antigo, novo), count in sorted(substituicoes.items(), key=lambda x: -x[1])[:20]:
    print(f"  [{count:3d}x] '{antigo}' -> '{novo}'")

# Executar UPDATEs
print(f"\nExecutando {len(updates)} UPDATEs...")
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
