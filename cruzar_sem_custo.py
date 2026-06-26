#!/usr/bin/env python3
"""
Cruza os produtos sem custo do banco com a planilha de custos.
Estratégia de matching:
1. Match direto por SKU
2. Match por troca de prefixo (LLE↔ALE, LLS↔ALS, etc.)
3. Match por número de família + sufixo parcial (últimos chars do SKU)
4. Match por número de família + palavras-chave da descrição
"""
import json, re, gc
import mysql.connector
import openpyxl
from difflib import SequenceMatcher

# ─── Conexão banco ────────────────────────────────────────────────────────────
with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()
conn = mysql.connector.connect(host=host, port=int(port), user=user, password=password, database=dbname, ssl_disabled=False)
cursor = conn.cursor(dictionary=True)

# Buscar todos os produtos sem custo
cursor.execute("""
    SELECT id, sku, produto, familia, categoria,
           driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali,
           driverDimTriac110v, driverDimTriac220v,
           driverDim110vNaoAplicavel, driverDimDaliNaoAplicavel,
           driverDimTriac110vNaoAplicavel, driverDimTriac220vNaoAplicavel,
           custoCorpoOnoff220v, custoCorpoOnoffBivolt,
           custoCorpoDim110v, custoCorpoDimDali
    FROM products
    ORDER BY sku
""")
all_products = cursor.fetchall()
conn.close()

def has_custo(p):
    for f in ['custoCorpoOnoff220v','custoCorpoOnoffBivolt','custoCorpoDim110v','custoCorpoDimDali']:
        v = p.get(f)
        if v and float(v) > 0:
            return True
    return False

sem_custo = [p for p in all_products if not has_custo(p)]
print(f"Total produtos: {len(all_products)}, Sem custo: {len(sem_custo)}")

# ─── Ler planilha — agrupar por SKU único ─────────────────────────────────────
print("Lendo planilha...")
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

# planilha_skus: { SKU_LIMPO: {custo, mkp_padrao, mkp_minimo, drivers, descricao_completa} }
planilha_skus = {}

for row in ws.iter_rows(min_row=2, values_only=True):
    col_a = row[0]
    col_b = row[1]
    col_c = row[2]
    col_d = row[3]
    col_g = row[6] if len(row) > 6 else None

    if col_a is None or col_b is None:
        continue
    try:
        custo = float(col_b)
    except:
        continue
    if custo <= 0:
        continue

    raw = str(col_a).strip()
    if ' - ' in raw:
        sku_plan = raw.split(' - ')[0].strip().upper()
        desc_plan = raw.split(' - ', 1)[1].strip().upper()
    else:
        sku_plan = raw.upper()
        desc_plan = ''

    if not sku_plan or sku_plan == 'DESCRIÇÃO DO PRODUTO':
        continue

    mkp_padrao = None
    mkp_minimo = None
    try:
        if col_c: mkp_padrao = float(col_c)
    except: pass
    try:
        if col_d: mkp_minimo = float(col_d)
    except: pass

    driver_tipo = str(col_g).upper().strip() if col_g else ''

    if sku_plan not in planilha_skus:
        planilha_skus[sku_plan] = {
            'custo': custo, 'mkp_padrao': mkp_padrao, 'mkp_minimo': mkp_minimo,
            'drivers': set(), 'descricao': desc_plan
        }
    if driver_tipo:
        planilha_skus[sku_plan]['drivers'].add(driver_tipo)

wb.close()
del wb
gc.collect()

print(f"SKUs únicos na planilha: {len(planilha_skus)}")

# ─── Prefixos equivalentes ────────────────────────────────────────────────────
PREFIX_ALTS = {
    'LLE': ['ALE'], 'LLS': ['ALS'], 'LLP': ['ALP'],
    'LDE': ['ADE'], 'LDS': ['ADS'], 'LDP': ['ADP'],
    'LDA': ['ADA'], 'LDB': ['ADB'], 'LFE': ['AFE'], 'LFS': ['AFS'],
    'ALE': ['LLE'], 'ALS': ['LLS'], 'ALP': ['LLP'],
    'ADE': ['LDE'], 'ADS': ['LDS'], 'ADP': ['LDP'],
    'ADA': ['LDA'], 'ADB': ['LDB'], 'AFE': ['LFE'], 'AFS': ['LFS'],
}

def extract_familia_num(sku):
    """Extrai número de família. Ex: LLE-2103.450.28F → 2103"""
    m = re.match(r'^[A-Z]+-(\d+)', sku.upper())
    return m.group(1) if m else None

def extract_sufixo(sku):
    """Extrai sufixo após o número de família. Ex: LLE-2103.450.28F → .450.28F"""
    m = re.match(r'^[A-Z]+-\d+(.*)', sku.upper())
    return m.group(1) if m else ''

def similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()

def desc_keywords(desc):
    """Extrai palavras-chave numéricas e significativas da descrição."""
    # Números, dimensões, potências
    nums = re.findall(r'\d+(?:[.,]\d+)?(?:W|MM|CM|M|W|K)?', desc.upper())
    return set(nums)

# ─── Indexar planilha por família ────────────────────────────────────────────
plan_by_familia = {}  # fnum → lista de (sku_plan, dados)
for sku_plan, dados in planilha_skus.items():
    fnum = extract_familia_num(sku_plan)
    if fnum:
        plan_by_familia.setdefault(fnum, []).append((sku_plan, dados))

# ─── Cruzar cada produto sem custo ───────────────────────────────────────────
matches_encontrados = []  # (produto_banco, sku_plan, dados_plan, metodo, confianca)
sem_match = []

for prod in sem_custo:
    sku_banco = (prod['sku'] or '').upper().strip()
    desc_banco = (prod['produto'] or '').upper().strip()
    fnum = extract_familia_num(sku_banco)
    suf_banco = extract_sufixo(sku_banco)

    melhor_match = None
    melhor_conf = 0
    melhor_metodo = ''

    # 1. Match direto
    if sku_banco in planilha_skus:
        melhor_match = planilha_skus[sku_banco]
        melhor_conf = 1.0
        melhor_metodo = 'direto'

    # 2. Troca de prefixo
    if not melhor_match:
        prefix = sku_banco[:3]
        suf = sku_banco[3:]
        for alt in PREFIX_ALTS.get(prefix, []):
            alt_sku = alt + suf
            if alt_sku in planilha_skus:
                melhor_match = planilha_skus[alt_sku]
                melhor_conf = 0.98
                melhor_metodo = f'prefixo {prefix}→{alt}'
                break

    # 3. Match por família + sufixo idêntico
    if not melhor_match and fnum and fnum in plan_by_familia:
        for sku_plan, dados in plan_by_familia[fnum]:
            suf_plan = extract_sufixo(sku_plan)
            if suf_banco and suf_plan and suf_banco == suf_plan:
                melhor_match = dados
                melhor_conf = 0.95
                melhor_metodo = f'família {fnum} + sufixo idêntico'
                break

    # 4. Match por família + sufixo parcial (últimos 6 chars)
    if not melhor_match and fnum and fnum in plan_by_familia:
        suf6 = suf_banco[-6:] if len(suf_banco) >= 6 else suf_banco
        for sku_plan, dados in plan_by_familia[fnum]:
            suf_plan = extract_sufixo(sku_plan)
            suf6_plan = suf_plan[-6:] if len(suf_plan) >= 6 else suf_plan
            if suf6 and suf6 == suf6_plan:
                melhor_match = dados
                melhor_conf = 0.90
                melhor_metodo = f'família {fnum} + sufixo parcial'
                break

    # 5. Match por família + similaridade de descrição
    if not melhor_match and fnum and fnum in plan_by_familia:
        best_sim = 0
        best_item = None
        kw_banco = desc_keywords(desc_banco)
        for sku_plan, dados in plan_by_familia[fnum]:
            desc_plan = dados.get('descricao', '')
            kw_plan = desc_keywords(desc_plan)
            # Similaridade por palavras-chave numéricas em comum
            if kw_banco and kw_plan:
                intersect = kw_banco & kw_plan
                sim = len(intersect) / max(len(kw_banco), len(kw_plan))
            else:
                sim = similarity(desc_banco, desc_plan)
            if sim > best_sim:
                best_sim = sim
                best_item = (sku_plan, dados)
        if best_sim >= 0.5 and best_item:
            melhor_match = best_item[1]
            melhor_conf = best_sim * 0.85  # penalizar por ser match por descrição
            melhor_metodo = f'família {fnum} + descrição (sim={best_sim:.2f})'

    if melhor_match:
        matches_encontrados.append((prod, melhor_match, melhor_metodo, melhor_conf))
    else:
        sem_match.append(prod)

print(f"\nMatches encontrados: {len(matches_encontrados)}")
print(f"Sem match: {len(sem_match)}")

# ─── Mostrar matches para revisão ────────────────────────────────────────────
print("\n=== MATCHES ENCONTRADOS ===")
# Agrupar por confiança
alta = [(p, d, met, c) for p, d, met, c in matches_encontrados if c >= 0.90]
media = [(p, d, met, c) for p, d, met, c in matches_encontrados if 0.70 <= c < 0.90]
baixa = [(p, d, met, c) for p, d, met, c in matches_encontrados if c < 0.70]

print(f"\n  Alta confiança (≥90%): {len(alta)}")
for prod, dados, met, conf in alta[:20]:
    print(f"    [{conf:.0%}] {prod['sku']:<30} → custo={dados['custo']:.4f} ({met})")
    print(f"           banco: {prod['produto'][:50]}")
    print(f"           plan:  {dados.get('descricao','')[:50]}")

print(f"\n  Média confiança (70-89%): {len(media)}")
for prod, dados, met, conf in media[:20]:
    print(f"    [{conf:.0%}] {prod['sku']:<30} → custo={dados['custo']:.4f} ({met})")
    print(f"           banco: {prod['produto'][:50]}")
    print(f"           plan:  {dados.get('descricao','')[:50]}")

print(f"\n  Baixa confiança (<70%): {len(baixa)}")
for prod, dados, met, conf in baixa[:10]:
    print(f"    [{conf:.0%}] {prod['sku']:<30} → custo={dados['custo']:.4f} ({met})")
    print(f"           banco: {prod['produto'][:50]}")
    print(f"           plan:  {dados.get('descricao','')[:50]}")

print(f"\n=== SEM MATCH ({len(sem_match)}) ===")
for prod in sem_match[:30]:
    print(f"  {prod['sku']:<30} {prod['produto'][:50]}")
