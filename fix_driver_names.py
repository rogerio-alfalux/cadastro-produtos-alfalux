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

# 1. Carregar todos os drivers oficiais da tabela components
cursor.execute("""
    SELECT id, tipo, modelo, codigo, custo, custoDriver
    FROM components
    WHERE tipo IN ('DRIVER_ONOFF_220','DRIVER_ONOFF_BIVOLT','DRIVER_DIM_110V',
                   'DRIVER_DIM_DALI','DRIVER_DIM_TRIAC_110V','DRIVER_DIM_TRIAC_220V')
    AND codigo IS NOT NULL AND codigo != ''
    ORDER BY codigo
""")
components = cursor.fetchall()
print(f"Drivers oficiais com código EQ: {len(components)}")

# Indexar por código EQ -> modelo oficial e custo
eq_to_oficial = {}  # codigo -> {modelo, custo, tipo}
for c in components:
    codigo = c['codigo'].strip().upper()
    custo = float(c['custoDriver']) if c['custoDriver'] else (float(c['custo']) if c['custo'] else None)
    eq_to_oficial[codigo] = {
        'modelo': c['modelo'],
        'custo': custo,
        'tipo': c['tipo']
    }

# Função para extrair código EQ de uma string de driver
def extract_eq_code(texto):
    if not texto:
        return None
    # Padrão: (EQ00XXX) ou EQ00XXX
    m = re.search(r'\(?(EQ\d{5})\)?', texto, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return None

# 2. Campos de driver nos produtos (campo_modelo, campo_custo)
DRIVER_FIELDS = [
    ('driverOnoff220',     'custoDriverOnoff220'),
    ('driverOnoffBivolt',  'custoDriverOnoffBivolt'),
    ('driverDim110v',      'custoDriverDim110v'),
    ('driverDimDali',      'custoDriverDimDali'),
    ('driverDimTriac110v', 'custoDriverDimTriac110v'),
    ('driverDimTriac220v', 'custoDriverDimTriac220v'),
    # Extras (sem campo de custo separado, mas atualizar o modelo)
    ('driverOnoff220Extra',     None),
    ('driverOnoffBivoltExtra',  None),
    ('driverDim110vExtra',      None),
    ('driverDimDaliExtra',      None),
    ('driverDimTriac110vExtra', None),
    ('driverDimTriac220vExtra', None),
]

# 3. Buscar todos os produtos
all_fields = ['id', 'sku'] + [f[0] for f in DRIVER_FIELDS] + [f[1] for f in DRIVER_FIELDS if f[1]]
# Remover duplicatas mantendo ordem
seen = set()
unique_fields = []
for f in all_fields:
    if f not in seen:
        seen.add(f)
        unique_fields.append(f)

cursor.execute(f"SELECT {', '.join(unique_fields)} FROM products")
products = cursor.fetchall()
print(f"Total de produtos: {len(products)}")

# 4. Varredura
updates = []
substituicoes = defaultdict(int)  # (antigo_eq, novo_modelo) -> count
sem_eq_mas_desatualizado = []

for prod in products:
    prod_updates = {}
    
    for driver_field, custo_field in DRIVER_FIELDS:
        modelo_atual = prod.get(driver_field)
        if not modelo_atual or not modelo_atual.strip():
            continue
        
        # Ignorar valores especiais
        modelo_strip = modelo_atual.strip()
        if modelo_strip.upper() in ('NÃO APLICÁVEL', 'NAO APLICAVEL', 'N/A', 
                                     'NÃO TEM OPÇÃO BIVOLT', 'FORA DO LIMITE (6.0B) — CONSULTAR ENGENHARIA',
                                     'N/A — STRIPLINE: BARRAS INTEIRAS APENAS'):
            continue
        
        # Extrair código EQ do modelo atual
        eq_code = extract_eq_code(modelo_atual)
        
        if eq_code and eq_code in eq_to_oficial:
            oficial = eq_to_oficial[eq_code]
            modelo_oficial = oficial['modelo']
            
            # Verificar se o modelo atual já é o oficial
            if modelo_atual.strip() != modelo_oficial.strip():
                prod_updates[driver_field] = modelo_oficial
                substituicoes[(eq_code, modelo_atual[:50], modelo_oficial[:50])] += 1
                
                # Atualizar custo também se disponível
                if custo_field and oficial['custo']:
                    prod_updates[custo_field] = oficial['custo']
            else:
                # Modelo já está correto, mas verificar custo
                if custo_field and oficial['custo']:
                    custo_atual = prod.get(custo_field)
                    if custo_atual is None or float(custo_atual) == 0:
                        prod_updates[custo_field] = oficial['custo']
        elif eq_code:
            # Tem EQ mas não encontrou no catálogo
            pass
        else:
            # Não tem EQ — verificar se é um modelo que existe no catálogo por nome exato
            # (para casos onde o modelo antigo não tem EQ mas o oficial tem)
            pass
    
    if prod_updates:
        updates.append((prod['id'], prod['sku'], prod_updates))

print(f"\nProdutos a atualizar: {len(updates)}")
print(f"\nSubstituições realizadas:")
for (eq, antigo, novo), count in sorted(substituicoes.items(), key=lambda x: -x[1])[:30]:
    print(f"  [{count:3d}x] {eq}: '{antigo}' -> '{novo}'")

# 5. Executar os UPDATEs
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
