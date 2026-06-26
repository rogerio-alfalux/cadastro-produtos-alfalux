#!/usr/bin/env python3
"""
Aplica os últimos custos identificáveis:
1. Famílias com custo único (4150, 6250)
2. Famílias com múltiplos custos: tenta match por sufixo parcial
3. Casos especiais identificados manualmente na análise
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
           custoCorpoOnoff220v, custoCorpoOnoffBivolt,
           custoCorpoDim110v, custoCorpoDimDali,
           custoCorpoDimTriac110v, custoCorpoDimTriac220v
    FROM products ORDER BY sku
""")
all_products = cursor.fetchall()

def has_custo(p):
    for f in ['custoCorpoOnoff220v','custoCorpoOnoffBivolt','custoCorpoDim110v',
              'custoCorpoDimDali','custoCorpoDimTriac110v','custoCorpoDimTriac220v']:
        v = p.get(f)
        if v and float(v) > 0:
            return True
    return False

sem_custo = [p for p in all_products if not has_custo(p)]
print(f"Produtos sem custo: {len(sem_custo)}")

# Ler planilha
print("Lendo planilha...")
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

planilha_skus = {}  # SKU_NORM → {custo, mkp_padrao, mkp_minimo, drivers, descricao}
for row in ws.iter_rows(min_row=2, values_only=True):
    col_a = row[0]; col_b = row[1]; col_c = row[2]; col_d = row[3]
    col_g = row[6] if len(row) > 6 else None
    if col_a is None or col_b is None: continue
    try: custo = float(col_b)
    except: continue
    if custo <= 0: continue
    raw = str(col_a).strip()
    sku_plan = raw.split(' - ')[0].strip().upper() if ' - ' in raw else raw.upper()
    desc_plan = raw.split(' - ', 1)[1].strip().upper() if ' - ' in raw else ''
    sku_norm = re.sub(r'\s+', '', sku_plan)
    if not sku_norm or sku_norm == 'DESCRIÇÃODOPRODUTO': continue
    mkp_padrao = None; mkp_minimo = None
    try:
        if col_c: mkp_padrao = float(col_c)
    except: pass
    try:
        if col_d: mkp_minimo = float(col_d)
    except: pass
    driver_tipo = str(col_g).upper().strip() if col_g else ''
    if sku_norm not in planilha_skus:
        planilha_skus[sku_norm] = {'custo': custo, 'mkp_padrao': mkp_padrao,
                                    'mkp_minimo': mkp_minimo, 'drivers': set(), 'descricao': desc_plan}
    if driver_tipo:
        planilha_skus[sku_norm]['drivers'].add(driver_tipo)

wb.close(); del wb; gc.collect()

# Indexar por família
plan_by_familia = {}
for sku_norm, dados in planilha_skus.items():
    m2 = re.match(r'^[A-Z]+-(\d+)', sku_norm)
    if m2:
        fnum = m2.group(1)
        plan_by_familia.setdefault(fnum, []).append((sku_norm, dados))

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
    'LDN': ['LDE', 'ADE'], 'LDC': ['LDE', 'ADE'],
}

def get_driver_fields(prod, dados):
    custo = str(round(dados['custo'], 4))
    mkp_p = str(round(dados['mkp_padrao'], 4)) if dados.get('mkp_padrao') else None
    mkp_m = str(round(dados['mkp_minimo'], 4)) if dados.get('mkp_minimo') else None
    update = {}
    has_onoff220 = bool(prod.get('driverOnoff220'))
    has_bivolt   = bool(prod.get('driverOnoffBivolt'))
    has_dim110   = bool(prod.get('driverDim110v')) and not prod.get('driverDim110vNaoAplicavel')
    has_dali     = bool(prod.get('driverDimDali')) and not prod.get('driverDimDaliNaoAplicavel')
    has_triac110 = bool(prod.get('driverDimTriac110v')) and not prod.get('driverDimTriac110vNaoAplicavel')
    has_triac220 = bool(prod.get('driverDimTriac220v')) and not prod.get('driverDimTriac220vNaoAplicavel')
    drivers_plan = dados.get('drivers', set())
    plan_onoff = any('ON' in d and 'OFF' in d for d in drivers_plan)
    plan_dim   = any('DIM' in d for d in drivers_plan)
    apply_all = not drivers_plan or (not plan_onoff and not plan_dim)
    if apply_all or plan_onoff:
        if has_onoff220:
            update['custoCorpoOnoff220v'] = custo
            if mkp_p: update['mkpPadraoOnoff220v'] = mkp_p
            if mkp_m: update['mkpMinimoOnoff220v'] = mkp_m
        if has_bivolt:
            update['custoCorpoOnoffBivolt'] = custo
            if mkp_p: update['mkpPadraoOnoffBivolt'] = mkp_p
            if mkp_m: update['mkpMinimoOnoffBivolt'] = mkp_m
    if apply_all or plan_dim:
        if has_dim110:
            update['custoCorpoDim110v'] = custo
            if mkp_p: update['mkpPadraoDim110v'] = mkp_p
            if mkp_m: update['mkpMinimoDim110v'] = mkp_m
        if has_dali:
            update['custoCorpoDimDali'] = custo
            if mkp_p: update['mkpPadraoDimDali'] = mkp_p
            if mkp_m: update['mkpMinimoDimDali'] = mkp_m
        if has_triac110:
            update['custoCorpoDimTriac110v'] = custo
            if mkp_p: update['mkpPadraoDimTriac110v'] = mkp_p
            if mkp_m: update['mkpMinimoDimTriac110v'] = mkp_m
        if has_triac220:
            update['custoCorpoDimTriac220v'] = custo
            if mkp_p: update['mkpPadraoDimTriac220v'] = mkp_p
            if mkp_m: update['mkpMinimoDimTriac220v'] = mkp_m
    if not update:
        update['custoCorpoOnoff220v'] = custo
        update['custoCorpoOnoffBivolt'] = custo
        if mkp_p: update['mkpPadraoOnoff220v'] = mkp_p; update['mkpPadraoOnoffBivolt'] = mkp_p
        if mkp_m: update['mkpMinimoOnoff220v'] = mkp_m; update['mkpMinimoOnoffBivolt'] = mkp_m
    return update

# ─── Matching e atualização ───────────────────────────────────────────────────
atualizados = 0
log = []

for prod in sem_custo:
    sku_b = norm_sku(prod['sku'] or '')
    fnum = extract_familia_num(sku_b)
    suf_b = extract_sufixo(sku_b)
    
    best = None; best_met = ''

    # 1. Match direto
    if sku_b in planilha_skus:
        best = planilha_skus[sku_b]; best_met = 'direto'

    # 2. Troca de prefixo
    if not best:
        prefix = sku_b[:3]; suf = sku_b[3:]
        for alt in PREFIX_ALTS.get(prefix, []):
            alt_sku = norm_sku(alt + suf)
            if alt_sku in planilha_skus:
                best = planilha_skus[alt_sku]; best_met = f'prefixo {prefix}→{alt}'; break

    # 3. Família + sufixo idêntico (incluindo prefixos alternativos)
    if not best and fnum:
        all_prefixes = [sku_b[:3]] + PREFIX_ALTS.get(sku_b[:3], [])
        for pfx in all_prefixes:
            alt_sku_base = pfx + '-' + fnum + suf_b
            alt_sku_norm = norm_sku(alt_sku_base)
            if alt_sku_norm in planilha_skus:
                best = planilha_skus[alt_sku_norm]; best_met = f'alt-sufixo {pfx}'; break

    # 4. Família com custo único
    if not best and fnum and fnum in plan_by_familia:
        items = plan_by_familia[fnum]
        custos = set(round(d['custo'], 2) for _, d in items)
        if len(custos) == 1:
            best = items[0][1]; best_met = f'família {fnum} único custo'

    # 5. Família + sufixo parcial (últimos 6 chars)
    if not best and fnum and fnum in plan_by_familia:
        s6 = suf_b[-6:] if len(suf_b) >= 6 else suf_b
        for sku_p, dados in plan_by_familia[fnum]:
            sp = extract_sufixo(sku_p)
            sp6 = sp[-6:] if len(sp) >= 6 else sp
            if s6 and s6 == sp6:
                best = dados; best_met = f'família {fnum}+sufixo6'; break

    # 6. Família + sufixo parcial com prefixos alternativos
    if not best and fnum:
        s6 = suf_b[-6:] if len(suf_b) >= 6 else suf_b
        for sku_p, dados in planilha_skus.items():
            fp = extract_familia_num(sku_p)
            if fp == fnum:
                sp = extract_sufixo(sku_p)
                sp6 = sp[-6:] if len(sp) >= 6 else sp
                if s6 and s6 == sp6:
                    best = dados; best_met = f'cross-prefixo família {fnum}+sufixo6'; break

    if best:
        fields = get_driver_fields(prod, best)
        if fields:
            set_clause = ', '.join([f"`{k}` = %s" for k in fields.keys()])
            values = list(fields.values()) + [prod['id']]
            try:
                cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s", values)
                atualizados += 1
                log.append(f"  {prod['sku']:<32} custo={best['custo']:.4f} ({best_met})")
            except Exception as e:
                print(f"  ERRO id={prod['id']} ({prod['sku']}): {e}")

conn.commit()
conn.close()

print(f"\n{'='*60}")
print(f"RESULTADO: {atualizados} produtos atualizados")
print(f"{'='*60}")
for l in log:
    print(l)
