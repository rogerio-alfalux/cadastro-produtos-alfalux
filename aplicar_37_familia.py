#!/usr/bin/env python3
"""
Aplica custos para os 37 produtos que têm família na planilha mas SKU diferente.
Estratégia: para cada produto do banco, busca na planilha o SKU da mesma família
cujo sufixo numérico seja mais próximo (ex: .021 → 1X2, .031 → 1X3, .051 → 1X5 etc.)
ou usa o custo da planilha que melhor corresponde pela descrição.

Casos especiais identificados:
- Família 2488 (EASY LED POINT): .021=1X2, .031=1X3, .051=1X5, .081=2X6(?), .112=3X6, .180=4X6
  → usar o número do sufixo para mapear: 021→59.28, 031→59.28, 051→70.90, 081→70.90, 112→83.32, 180→83.32
- Família 1040 (LUNA SPOT): .1CO.11C=COB111=112.45, .1CO.70B=COB70=88.85
  → produtos 120.20B (COB70 ABS) → 88.85, 135.35B (35L) → sem match, 1T5 (50L) → sem match
- Família 6000 (MYRO): LDN → match por sufixo com LDE
- Família 2750 (ALE-2750): .124.20F → próximo de .124.21F → custo do .124.21F
- Família 2660 (BOX LED): LLS-2660.597 → próximo de LLS-2660.120 → custo do .120
- Família 1027 (ROYAL/MYCRO): LDE-1027.1CO.05S → MYCRO, não ROYAL → sem match confiável
"""
import json, re, gc
import mysql.connector
import openpyxl

with open('/home/ubuntu/cadastro-produtos-alfalux/.project-config.json') as f:
    config = json.load(f)
db_url = config['env_vars']['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
user, password, host, port, dbname = m.groups()
conn = mysql.connector.connect(host=host, port=int(port), user=user, password=password, database=dbname, ssl_disabled=False)
cursor = conn.cursor(dictionary=True)

cursor.execute("""
    SELECT id, sku, produto, familia, categoria,
           driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali,
           driverDimTriac110v, driverDimTriac220v,
           driverDim110vNaoAplicavel, driverDimDaliNaoAplicavel,
           driverDimTriac110vNaoAplicavel, driverDimTriac220vNaoAplicavel,
           custoCorpoOnoff220v, custoCorpoOnoffBivolt
    FROM products ORDER BY sku
""")
all_products = cursor.fetchall()

CUSTO_FIELDS = ['custoCorpoOnoff220v','custoCorpoOnoffBivolt','custoCorpoDim110v',
                'custoCorpoDimDali','custoCorpoDimTriac110v','custoCorpoDimTriac220v']
MKP_PAD_FIELDS = ['mkpPadraoOnoff220v','mkpPadraoOnoffBivolt','mkpPadraoDim110v',
                  'mkpPadraoDimDali','mkpPadraoDimTriac110v','mkpPadraoDimTriac220v']
MKP_MIN_FIELDS = ['mkpMinimoOnoff220v','mkpMinimoOnoffBivolt','mkpMinimoDim110v',
                  'mkpMinimoDimDali','mkpMinimoDimTriac110v','mkpMinimoDimTriac220v']
NAO_APLIC = {
    'custoCorpoDim110v': 'driverDim110vNaoAplicavel',
    'custoCorpoDimDali': 'driverDimDaliNaoAplicavel',
    'custoCorpoDimTriac110v': 'driverDimTriac110vNaoAplicavel',
    'custoCorpoDimTriac220v': 'driverDimTriac220vNaoAplicavel',
}

def has_custo(p):
    for f in CUSTO_FIELDS:
        v = p.get(f)
        if v and float(v) > 0: return True
    return False

sem_custo = [p for p in all_products
             if not has_custo(p) and (p.get('categoria') or '').upper() not in ('PERFIS','PERFIL')]

# Ler planilha
print("Lendo planilha...")
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active
planilha_skus_first = {}
for row in ws.iter_rows(min_row=2, values_only=True):
    col_a = row[0]; col_b = row[1]; col_c = row[2]; col_d = row[3]
    if col_a is None or col_b is None: continue
    try: custo = float(col_b)
    except: continue
    if custo <= 0: continue
    raw = str(col_a).strip()
    sku_plan = raw.split(' - ')[0].strip().upper() if ' - ' in raw else raw.upper()
    desc_plan = raw.split(' - ', 1)[1].strip().upper() if ' - ' in raw else ''
    sku_norm = re.sub(r'\s+', '', sku_plan)
    if not sku_norm or sku_norm == 'DESCRIÇÃODOPRODUTO': continue
    if sku_norm not in planilha_skus_first:
        mkp_padrao = None; mkp_minimo = None
        try:
            if col_c: mkp_padrao = float(col_c)
        except: pass
        try:
            if col_d: mkp_minimo = float(col_d)
        except: pass
        planilha_skus_first[sku_norm] = {'custo': custo, 'mkp_padrao': mkp_padrao,
                                          'mkp_minimo': mkp_minimo, 'descricao': desc_plan}
wb.close(); del wb; gc.collect()

# Indexar por família
plan_by_familia = {}
for sku_norm, dados in planilha_skus_first.items():
    m2 = re.match(r'^[A-Z]+-(\d+)', sku_norm)
    if m2:
        plan_by_familia.setdefault(m2.group(1), []).append((sku_norm, dados))

def norm_sku(sku):
    return re.sub(r'\s+', '', (sku or '').upper().strip())

def extract_familia_num(sku):
    m2 = re.match(r'^[A-Z]+-(\d+)', norm_sku(sku))
    return m2.group(1) if m2 else None

def extract_sufixo(sku):
    m2 = re.match(r'^[A-Z]+-\d+(.*)', norm_sku(sku))
    return m2.group(1) if m2 else ''

PREFIX_ALTS = {
    'LLE': ['ALE'], 'LLS': ['ALS'], 'LLP': ['ALP'],
    'LDE': ['ADE'], 'LDS': ['ADS'], 'LDP': ['ADP'],
    'LDA': ['ADA'], 'LDB': ['ADB'], 'LFE': ['AFE'], 'LFS': ['AFS'],
    'ALE': ['LLE'], 'ALS': ['LLS'], 'ALP': ['LLP'],
    'ADE': ['LDE'], 'ADS': ['LDS'], 'ADP': ['LDP'],
    'ADA': ['LDA'], 'ADB': ['LDB'], 'AFE': ['LFE'], 'AFS': ['LFS'],
    'LDN': ['LDE', 'ADE', 'LDS'], 'LDC': ['LDE', 'ADE'],
}

def sufixo_numerico(suf):
    """Extrai o primeiro número do sufixo. Ex: .021.18F → 21, .124.19F → 124"""
    nums = re.findall(r'\d+', suf)
    return int(nums[0]) if nums else 0

def find_custo_familia_closest(sku_b, fnum):
    """Para família com múltiplos custos, encontra o SKU da planilha com sufixo mais próximo."""
    if fnum not in plan_by_familia:
        return None, None
    items = plan_by_familia[fnum]
    suf_b = extract_sufixo(sku_b)
    num_b = sufixo_numerico(suf_b)
    
    # Tentar match exato de sufixo (ignorando prefixo)
    for sku_p, dados in items:
        suf_p = extract_sufixo(sku_p)
        if suf_b and suf_p and suf_b == suf_p:
            return dados, f'sufixo exato {suf_b}'
    
    # Tentar match por últimos 6 chars do sufixo
    s6 = suf_b[-6:] if len(suf_b) >= 6 else suf_b
    for sku_p, dados in items:
        suf_p = extract_sufixo(sku_p)
        sp6 = suf_p[-6:] if len(suf_p) >= 6 else suf_p
        if s6 and s6 == sp6:
            return dados, f'sufixo6 {s6}'
    
    # Tentar match por número mais próximo no sufixo
    if num_b > 0:
        best_dist = float('inf')
        best_item = None
        for sku_p, dados in items:
            suf_p = extract_sufixo(sku_p)
            num_p = sufixo_numerico(suf_p)
            if num_p > 0:
                dist = abs(num_b - num_p)
                if dist < best_dist:
                    best_dist = dist
                    best_item = (sku_p, dados)
        if best_item and best_dist <= 50:  # tolerância de 50 no número
            return best_item[1], f'sufixo próximo (dist={best_dist})'
    
    return None, None

def get_campos_aplicaveis(prod):
    campos = []
    for cf, pf, mf in zip(CUSTO_FIELDS, MKP_PAD_FIELDS, MKP_MIN_FIELDS):
        nao_aplic_field = NAO_APLIC.get(cf)
        if nao_aplic_field and prod.get(nao_aplic_field):
            continue
        campos.append((cf, pf, mf))
    return campos

def aplicar_custo(prod_id, campos, custo, mkp_p, mkp_m):
    update = {}
    for cf, pf, mf in campos:
        update[cf] = str(round(custo, 4))
        if mkp_p: update[pf] = str(round(mkp_p, 4))
        if mkp_m: update[mf] = str(round(mkp_m, 4))
    if update:
        set_clause = ', '.join([f"`{k}` = %s" for k in update.keys()])
        cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s", list(update.values()) + [prod_id])
        return True
    return False

# ─── Processar ───────────────────────────────────────────────────────────────
atualizados = 0
log = []
sem_match_final = []

for prod in sem_custo:
    sku_b = norm_sku(prod['sku'] or '')
    fnum = extract_familia_num(sku_b)
    campos = get_campos_aplicaveis(prod)
    
    best = None; best_met = ''
    
    # 1. Match direto
    if sku_b in planilha_skus_first:
        best = planilha_skus_first[sku_b]; best_met = 'direto'
    
    # 2. Troca de prefixo
    if not best:
        prefix = sku_b[:3]; suf = sku_b[3:]
        for alt in PREFIX_ALTS.get(prefix, []):
            alt_sku = norm_sku(alt + suf)
            if alt_sku in planilha_skus_first:
                best = planilha_skus_first[alt_sku]; best_met = f'prefixo {prefix}→{alt}'; break
    
    # 3. Família + sufixo mais próximo
    if not best and fnum:
        best, best_met = find_custo_familia_closest(sku_b, fnum)
    
    if best:
        if aplicar_custo(prod['id'], campos, best['custo'], best.get('mkp_padrao'), best.get('mkp_minimo')):
            atualizados += 1
            log.append(f"  {prod['sku']:<32} custo={best['custo']:.4f} ({best_met})")
    else:
        sem_match_final.append(prod)

conn.commit()
conn.close()

print(f"\n{'='*60}")
print(f"RESULTADO: {atualizados} produtos atualizados")
print(f"{'='*60}")
for l in log:
    print(l)

print(f"\n=== SEM MATCH FINAL ({len(sem_match_final)}) ===")
from collections import defaultdict
por_familia = defaultdict(list)
for prod in sem_match_final:
    fnum = extract_familia_num(norm_sku(prod['sku'] or '')) or 'SEM_FAMILIA'
    por_familia[fnum].append(prod)
for fnum in sorted(por_familia.keys()):
    prods = por_familia[fnum]
    print(f"  Família {fnum}: {len(prods)} produtos")
    for p in prods[:2]:
        print(f"    {p['sku']:<32} {p['produto'][:40]}")
