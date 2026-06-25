import json, re, os
import mysql.connector

os.chdir('/home/ubuntu/cadastro-produtos-alfalux')

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

# Campos de custo do corpo (todos os tipos de driver)
CUSTO_FIELDS = [
    'custoCorpoOnoff220v', 'custoCorpoOnoffBivolt', 'custoCorpoDim110v',
    'custoCorpoDimDali', 'custoCorpoDimTriac110v', 'custoCorpoDimTriac220v',
    'custoCorpoOnoff220vD1D2', 'custoCorpoOnoffBivoltD1D2', 'custoCorpoDim110vD1D2',
    'custoCorpoDimDaliD1D2', 'custoCorpoDimTriac110vD1D2', 'custoCorpoDimTriac220vD1D2'
]

# Buscar TODOS os produtos com seus custos
print("Buscando todos os produtos...")
fields_sql = ', '.join(CUSTO_FIELDS)
cursor.execute(f"SELECT sku, {fields_sql} FROM products ORDER BY sku")
rows = cursor.fetchall()
print(f"Total de produtos: {len(rows)}")

# Parsear os produtos
products = {}
for row in rows:
    sku = row['sku']
    custos = {field: float(row[field]) if row[field] is not None else None for field in CUSTO_FIELDS}
    products[sku] = custos

def parse_seg2(seg2):
    """
    Analisa o segundo segmento do SKU para identificar barras.
    
    Padrões observados:
    - '1IF', '1IN', '1ML' -> barra inteira 1, tipo acabamento F/N/L
      (primeiro dígito=barras, segundo char='I' ou 'M' = inteiro/meia, terceiro=acabamento)
    - '11F', '11I', '12F', '12M' -> fracionado: 1.1B, 1.2B, tipo F/I/M
      (primeiro dígito=barras base, segundo dígito=décimos, terceiro=acabamento)
    
    Retorna dict com:
    - 'barras_base': int (1-6)
    - 'fracao': int (0=inteiro, 1-9=décimos)
    - 'acabamento': str (última letra do seg2)
    - 'is_inteiro': bool
    """
    if not seg2 or len(seg2) < 2:
        return None
    
    first = seg2[0]
    if not first.isdigit():
        return None
    
    barras_base = int(first)
    second = seg2[1]
    
    # Padrão de barra inteira: segundo char é 'I' (inteiro) ou 'M' (meia/ML)
    # Ex: '1IF', '1IN', '1ML', '2IF', '2ML'
    if second.upper() in ('I', 'M') and len(seg2) >= 3:
        acabamento = seg2[-1].upper()
        return {
            'barras_base': barras_base,
            'fracao': 0,
            'acabamento': acabamento,
            'is_inteiro': True,
            'seg2_tipo': second.upper()  # I ou M
        }
    
    # Padrão de barra fracionada: segundo char é dígito
    # Ex: '11F', '12I', '23F', '56M'
    if second.isdigit():
        fracao = int(second)
        acabamento = seg2[-1].upper() if len(seg2) >= 3 else ''
        return {
            'barras_base': barras_base,
            'fracao': fracao,
            'acabamento': acabamento,
            'is_inteiro': False,
            'seg2_tipo': None
        }
    
    return None

def get_sku_parts(sku):
    """Divide o SKU em (prefixo, seg2, sufixo)"""
    parts = sku.split('.')
    if len(parts) < 3:
        return None
    return (parts[0], parts[1], '.'.join(parts[2:]))

# Construir grupos por (prefixo, sufixo)
# Dentro de cada grupo, mapear barras_base -> custos da barra inteira
grupos = {}

for sku, custos in products.items():
    parts = get_sku_parts(sku)
    if not parts:
        continue
    prefixo, seg2, sufixo = parts
    parsed = parse_seg2(seg2)
    if not parsed:
        continue
    
    chave = (prefixo, sufixo)
    if chave not in grupos:
        grupos[chave] = {'inteiros': {}, 'fracionados': []}
    
    if parsed['is_inteiro']:
        barras_base = parsed['barras_base']
        # Guardar custo da barra inteira (pode haver IF, IN, ML com custos diferentes)
        # Usar o primeiro que tiver custo, ou o IF como preferência
        if barras_base not in grupos[chave]['inteiros']:
            grupos[chave]['inteiros'][barras_base] = {}
        tipo = parsed['seg2_tipo']
        grupos[chave]['inteiros'][barras_base][tipo] = {'sku': sku, 'custos': custos}
    else:
        grupos[chave]['fracionados'].append({
            'sku': sku,
            'barras_base': parsed['barras_base'],
            'fracao': parsed['fracao'],
            'acabamento': parsed['acabamento'],
            'custos': custos
        })

print(f"Total de grupos: {len(grupos)}")

# Calcular custos das variações fracionadas
updates = []
sem_base = []

for chave, grupo in grupos.items():
    prefixo, sufixo = chave
    inteiros = grupo['inteiros']
    fracionados = grupo['fracionados']
    
    if not fracionados:
        continue
    
    for frac_info in fracionados:
        barras_base = frac_info['barras_base']
        fracao = frac_info['fracao']
        sku = frac_info['sku']
        custos_atuais = frac_info['custos']
        
        # Verificar se já tem custo
        tem_custo = any(v is not None and v > 0 for v in custos_atuais.values())
        if tem_custo:
            continue
        
        # Buscar custo da barra inteira base
        if barras_base not in inteiros:
            sem_base.append(sku)
            continue
        
        # Pegar o custo da barra inteira (preferência: I, depois M)
        tipos_inteiros = inteiros[barras_base]
        custo_base = None
        for tipo_pref in ('I', 'M'):
            if tipo_pref in tipos_inteiros:
                info = tipos_inteiros[tipo_pref]
                tem_custo_base = any(v is not None and v > 0 for v in info['custos'].values())
                if tem_custo_base:
                    custo_base = info['custos']
                    break
        
        if custo_base is None:
            sem_base.append(sku)
            continue
        
        percentual = fracao * 0.10  # 1=10%, 2=20%, etc.
        
        # Calcular novos custos
        novos_custos = {}
        for field in CUSTO_FIELDS:
            if custo_base.get(field) is not None and custo_base[field] > 0:
                novos_custos[field] = round(custo_base[field] * (1 + percentual), 4)
        
        if novos_custos:
            updates.append((sku, novos_custos, barras_base, fracao, custo_base))

print(f"Total de produtos a atualizar: {len(updates)}")
if sem_base:
    print(f"Produtos sem base encontrada: {len(sem_base)}")
    for s in sem_base[:5]:
        print(f"  {s}")

print("\nExemplos de atualizações:")
for sku, custos, barras_base, fracao, custo_base in updates[:20]:
    base_custo = custo_base.get('custoCorpoOnoff220v')
    novo_custo = custos.get('custoCorpoOnoff220v')
    print(f"  {sku}: {barras_base}B base={base_custo} +{fracao*10}% -> {novo_custo}")

# Executar os UPDATEs
print("\nExecutando UPDATEs...")
success = 0
errors = 0

update_cursor = conn.cursor()
for sku, custos, _, _, _ in updates:
    set_parts = []
    vals = []
    for field, val in custos.items():
        set_parts.append(f"{field} = %s")
        vals.append(val)
    vals.append(sku)
    
    sql = f"UPDATE products SET {', '.join(set_parts)} WHERE sku = %s"
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
