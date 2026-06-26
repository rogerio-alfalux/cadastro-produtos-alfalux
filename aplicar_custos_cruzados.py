#!/usr/bin/env python3
"""
Versão final: cruza todos os produtos sem custo com a planilha e aplica os custos.
Normaliza SKUs com espaços, trata prefixos alternativos e busca por família+descrição.
Só aplica matches com confiança >= 70%.
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

# ─── Ler planilha ─────────────────────────────────────────────────────────────
print("Lendo planilha...")
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

planilha_skus = {}  # SKU_NORM → {custo, mkp_padrao, mkp_minimo, drivers, descricao}

for row in ws.iter_rows(min_row=2, values_only=True):
    col_a = row[0]; col_b = row[1]; col_c = row[2]; col_d = row[3]
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
        sku_plan = raw.upper(); desc_plan = ''
    if not sku_plan or sku_plan == 'DESCRIÇÃO DO PRODUTO':
        continue
    # Normalizar: remover espaços internos
    sku_norm = re.sub(r'\s+', '', sku_plan)
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
print(f"SKUs únicos na planilha: {len(planilha_skus)}")

# ─── Helpers ─────────────────────────────────────────────────────────────────
PREFIX_ALTS = {
    'LLE': ['ALE'], 'LLS': ['ALS'], 'LLP': ['ALP'],
    'LDE': ['ADE'], 'LDS': ['ADS'], 'LDP': ['ADP'],
    'LDA': ['ADA'], 'LDB': ['ADB'], 'LFE': ['AFE'], 'LFS': ['AFS'],
    'ALE': ['LLE'], 'ALS': ['LLS'], 'ALP': ['LLP'],
    'ADE': ['LDE'], 'ADS': ['LDS'], 'ADP': ['LDP'],
    'ADA': ['LDA'], 'ADB': ['LDB'], 'AFE': ['LFE'], 'AFS': ['LFS'],
    'LDN': ['LDE','ADE'], 'LDC': ['LDE','ADE'],
}

def norm_sku(sku):
    return re.sub(r'\s+', '', sku.upper().strip())

def extract_familia_num(sku):
    m = re.match(r'^[A-Z]+-(\d+)', norm_sku(sku))
    return m.group(1) if m else None

def extract_sufixo(sku):
    m = re.match(r'^[A-Z]+-\d+(.*)', norm_sku(sku))
    return m.group(1) if m else ''

def desc_keywords(desc):
    """Extrai números e dimensões relevantes."""
    return set(re.findall(r'\d+(?:[.,]\d+)?(?:W|MM|CM)?', desc.upper()))

# Indexar planilha por família
plan_by_familia = {}
for sku_norm, dados in planilha_skus.items():
    fnum = extract_familia_num(sku_norm)
    if fnum:
        plan_by_familia.setdefault(fnum, []).append((sku_norm, dados))

# ─── Matching ────────────────────────────────────────────────────────────────
matches = []  # (prod, dados_plan, metodo, confianca)
sem_match = []

for prod in sem_custo:
    sku_b = norm_sku(prod['sku'] or '')
    desc_b = (prod['produto'] or '').upper()
    fnum = extract_familia_num(sku_b)
    suf_b = extract_sufixo(sku_b)

    best = None; best_conf = 0; best_met = ''

    # 1. Match direto (normalizado)
    if sku_b in planilha_skus:
        best = planilha_skus[sku_b]; best_conf = 1.0; best_met = 'direto'

    # 2. Troca de prefixo
    if not best:
        prefix = sku_b[:3]; suf = sku_b[3:]
        for alt in PREFIX_ALTS.get(prefix, []):
            alt_sku = norm_sku(alt + suf)
            if alt_sku in planilha_skus:
                best = planilha_skus[alt_sku]; best_conf = 0.98
                best_met = f'prefixo {prefix}→{alt}'; break

    # 3. Família + sufixo idêntico
    if not best and fnum and fnum in plan_by_familia:
        for sku_p, dados in plan_by_familia[fnum]:
            if suf_b and extract_sufixo(sku_p) == suf_b:
                best = dados; best_conf = 0.95
                best_met = f'família {fnum}+sufixo'; break

    # 4. Família + sufixo parcial (últimos 6 chars)
    if not best and fnum and fnum in plan_by_familia:
        s6 = suf_b[-6:] if len(suf_b) >= 6 else suf_b
        for sku_p, dados in plan_by_familia[fnum]:
            sp6 = extract_sufixo(sku_p)
            sp6 = sp6[-6:] if len(sp6) >= 6 else sp6
            if s6 and s6 == sp6:
                best = dados; best_conf = 0.90
                best_met = f'família {fnum}+sufixo6'; break

    # 5. Família + palavras-chave numéricas da descrição
    if not best and fnum and fnum in plan_by_familia:
        kw_b = desc_keywords(desc_b)
        best_sim = 0; best_item = None
        for sku_p, dados in plan_by_familia[fnum]:
            kw_p = desc_keywords(dados.get('descricao',''))
            if kw_b and kw_p:
                inter = kw_b & kw_p
                sim = len(inter) / max(len(kw_b), len(kw_p))
            else:
                sim = SequenceMatcher(None, desc_b, dados.get('descricao','')).ratio()
            if sim > best_sim:
                best_sim = sim; best_item = (sku_p, dados)
        if best_sim >= 0.6 and best_item:
            best = best_item[1]; best_conf = best_sim * 0.85
            best_met = f'família {fnum}+desc({best_sim:.0%})'

    # 6. Busca por família em prefixos alternativos
    if not best and fnum:
        prefix = sku_b[:3]
        for alt_prefix in PREFIX_ALTS.get(prefix, []):
            alt_fnum_key = alt_prefix + '-' + fnum
            # Tentar encontrar na planilha com prefixo alternativo
            for sku_p, dados in planilha_skus.items():
                fp = extract_familia_num(sku_p)
                if fp == fnum:
                    suf_p = extract_sufixo(sku_p)
                    if suf_b and suf_p and suf_b == suf_p:
                        best = dados; best_conf = 0.93
                        best_met = f'alt-família {fnum}+sufixo'; break
            if best:
                break

    if best and best_conf >= 0.70:
        matches.append((prod, best, best_met, best_conf))
    else:
        sem_match.append(prod)

print(f"\nMatches encontrados (conf ≥70%): {len(matches)}")
print(f"Sem match: {len(sem_match)}")

# ─── Aplicar custos ───────────────────────────────────────────────────────────
def get_driver_fields(prod, dados):
    """Determina quais campos atualizar baseado nos drivers do produto no banco."""
    custo = str(round(dados['custo'], 4))
    mkp_p = str(round(dados['mkp_padrao'], 4)) if dados['mkp_padrao'] else None
    mkp_m = str(round(dados['mkp_minimo'], 4)) if dados['mkp_minimo'] else None
    update = {}

    # Verificar quais drivers o produto tem no banco
    has_onoff220  = bool(prod.get('driverOnoff220'))
    has_bivolt    = bool(prod.get('driverOnoffBivolt')) and not prod.get('driverOnoffBivoltNaoAplicavel')
    has_dim110    = bool(prod.get('driverDim110v')) and not prod.get('driverDim110vNaoAplicavel')
    has_dali      = bool(prod.get('driverDimDali')) and not prod.get('driverDimDaliNaoAplicavel')
    has_triac110  = bool(prod.get('driverDimTriac110v')) and not prod.get('driverDimTriac110vNaoAplicavel')
    has_triac220  = bool(prod.get('driverDimTriac220v')) and not prod.get('driverDimTriac220vNaoAplicavel')

    # Verificar tipos de driver da planilha
    drivers_plan = dados.get('drivers', set())
    plan_onoff = any('ON' in d and 'OFF' in d for d in drivers_plan)
    plan_dim   = any('DIM' in d for d in drivers_plan)
    plan_dali  = any('DALI' in d for d in drivers_plan)
    plan_triac = any('TRIAC' in d for d in drivers_plan)

    # Se planilha não especifica driver, aplicar em todos os drivers do produto
    apply_all = not drivers_plan or (not plan_onoff and not plan_dim and not plan_dali and not plan_triac)

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

    if apply_all or plan_dali:
        if has_dali:
            update['custoCorpoDimDali'] = custo
            if mkp_p: update['mkpPadraoDimDali'] = mkp_p
            if mkp_m: update['mkpMinimoDimDali'] = mkp_m

    if apply_all or plan_triac:
        if has_triac110:
            update['custoCorpoDimTriac110v'] = custo
            if mkp_p: update['mkpPadraoDimTriac110v'] = mkp_p
            if mkp_m: update['mkpMinimoDimTriac110v'] = mkp_m
        if has_triac220:
            update['custoCorpoDimTriac220v'] = custo
            if mkp_p: update['mkpPadraoDimTriac220v'] = mkp_p
            if mkp_m: update['mkpMinimoDimTriac220v'] = mkp_m

    # Se produto não tem nenhum driver específico identificado, aplicar em ON/OFF
    if not update:
        update['custoCorpoOnoff220v'] = custo
        update['custoCorpoOnoffBivolt'] = custo
        if mkp_p: update['mkpPadraoOnoff220v'] = mkp_p; update['mkpPadraoOnoffBivolt'] = mkp_p
        if mkp_m: update['mkpMinimoOnoff220v'] = mkp_m; update['mkpMinimoOnoffBivolt'] = mkp_m

    return update

print("\nAplicando custos...")
atualizados = 0
erros = 0
log = []

for prod, dados, metodo, conf in matches:
    fields = get_driver_fields(prod, dados)
    if not fields:
        continue
    set_clause = ', '.join([f"`{k}` = %s" for k in fields.keys()])
    values = list(fields.values()) + [prod['id']]
    try:
        cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s", values)
        atualizados += 1
        log.append(f"  [{conf:.0%}] {prod['sku']:<30} custo={dados['custo']:.4f} ({metodo})")
    except Exception as e:
        erros += 1
        print(f"  ERRO id={prod['id']} ({prod['sku']}): {e}")

conn.commit()
conn.close()

print(f"\n{'='*60}")
print(f"RESULTADO:")
print(f"  Produtos atualizados: {atualizados}")
print(f"  Erros: {erros}")
print(f"  Sem match: {len(sem_match)}")
print(f"{'='*60}")

print(f"\nProdutos atualizados:")
for l in log:
    print(l)

print(f"\n=== SEM MATCH ({len(sem_match)}) ===")
for prod in sem_match:
    print(f"  {prod['sku']:<32} {prod['produto'][:50]}")
