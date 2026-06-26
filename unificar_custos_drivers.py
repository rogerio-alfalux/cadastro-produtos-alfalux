#!/usr/bin/env python3
"""
Regra: o custo do corpo é IGUAL em todos os drivers de um produto (exceto perfis).
1. Para cada produto sem custo (exceto perfis): busca na planilha pelo SKU/família
   e preenche TODOS os campos de custo com o mesmo valor.
2. Para produtos que já têm custo mas com valores diferentes entre drivers: corrige
   usando o valor da planilha (ou o primeiro valor não-zero encontrado).
Ignora categoria PERFIS.
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

# Campos de custo e markup por driver
CUSTO_FIELDS = [
    'custoCorpoOnoff220v', 'custoCorpoOnoffBivolt',
    'custoCorpoDim110v', 'custoCorpoDimDali',
    'custoCorpoDimTriac110v', 'custoCorpoDimTriac220v',
]
MKP_PAD_FIELDS = [
    'mkpPadraoOnoff220v', 'mkpPadraoOnoffBivolt',
    'mkpPadraoDim110v', 'mkpPadraoDimDali',
    'mkpPadraoDimTriac110v', 'mkpPadraoDimTriac220v',
]
MKP_MIN_FIELDS = [
    'mkpMinimoOnoff220v', 'mkpMinimoOnoffBivolt',
    'mkpMinimoDim110v', 'mkpMinimoDimDali',
    'mkpMinimoDimTriac110v', 'mkpMinimoDimTriac220v',
]

# Campos de flag "não aplicável" por driver
NAO_APLIC = {
    'custoCorpoDim110v':    'driverDim110vNaoAplicavel',
    'custoCorpoDimDali':    'driverDimDaliNaoAplicavel',
    'custoCorpoDimTriac110v': 'driverDimTriac110vNaoAplicavel',
    'custoCorpoDimTriac220v': 'driverDimTriac220vNaoAplicavel',
}

cursor.execute("""
    SELECT id, sku, produto, familia, categoria,
           driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali,
           driverDimTriac110v, driverDimTriac220v,
           driverDim110vNaoAplicavel, driverDimDaliNaoAplicavel,
           driverDimTriac110vNaoAplicavel, driverDimTriac220vNaoAplicavel,
           custoCorpoOnoff220v, custoCorpoOnoffBivolt,
           custoCorpoDim110v, custoCorpoDimDali,
           custoCorpoDimTriac110v, custoCorpoDimTriac220v,
           mkpPadraoOnoff220v, mkpPadraoOnoffBivolt,
           mkpPadraoDim110v, mkpPadraoDimDali,
           mkpPadraoDimTriac110v, mkpPadraoDimTriac220v,
           mkpMinimoOnoff220v, mkpMinimoOnoffBivolt,
           mkpMinimoDim110v, mkpMinimoDimDali,
           mkpMinimoDimTriac110v, mkpMinimoDimTriac220v
    FROM products ORDER BY sku
""")
all_products = cursor.fetchall()
print(f"Total produtos: {len(all_products)}")

# Excluir perfis
nao_perfis = [p for p in all_products if (p.get('categoria') or '').upper() not in ('PERFIS', 'PERFIL')]
print(f"Sem perfis: {len(nao_perfis)}")

def get_custo_vals(p):
    vals = []
    for f in CUSTO_FIELDS:
        v = p.get(f)
        if v is not None:
            try:
                fv = float(v)
                if fv > 0:
                    vals.append(round(fv, 4))
            except: pass
    return vals

def has_custo(p):
    return len(get_custo_vals(p)) > 0

# ─── Ler planilha — primeira ocorrência por SKU ───────────────────────────────
print("Lendo planilha...")
wb = openpyxl.load_workbook('/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx', data_only=True, read_only=True)
ws = wb.active

planilha_skus = {}  # SKU_NORM → {custo, mkp_padrao, mkp_minimo} — apenas primeira ocorrência

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
    # Só registrar a PRIMEIRA ocorrência
    if sku_norm not in planilha_skus:
        mkp_padrao = None; mkp_minimo = None
        try:
            if col_c: mkp_padrao = float(col_c)
        except: pass
        try:
            if col_d: mkp_minimo = float(col_d)
        except: pass
        planilha_skus[sku_norm] = {'custo': custo, 'mkp_padrao': mkp_padrao,
                                    'mkp_minimo': mkp_minimo, 'descricao': desc_plan}

wb.close(); del wb; gc.collect()
print(f"SKUs únicos na planilha (1ª ocorrência): {len(planilha_skus)}")

# Indexar por família
plan_by_familia = {}
for sku_norm, dados in planilha_skus.items():
    m2 = re.match(r'^[A-Z]+-(\d+)', sku_norm)
    if m2:
        fnum = m2.group(1)
        plan_by_familia.setdefault(fnum, []).append((sku_norm, dados))

PREFIX_ALTS = {
    'LLE': ['ALE'], 'LLS': ['ALS'], 'LLP': ['ALP'],
    'LDE': ['ADE'], 'LDS': ['ADS'], 'LDP': ['ADP'],
    'LDA': ['ADA'], 'LDB': ['ADB'], 'LFE': ['AFE'], 'LFS': ['AFS'],
    'ALE': ['LLE'], 'ALS': ['LLS'], 'ALP': ['LLP'],
    'ADE': ['LDE'], 'ADS': ['LDS'], 'ADP': ['LDP'],
    'ADA': ['LDA'], 'ADB': ['LDB'], 'AFE': ['LFE'], 'AFS': ['LFS'],
    'LDN': ['LDE', 'ADE'], 'LDC': ['LDE', 'ADE'],
}

def norm_sku(sku):
    return re.sub(r'\s+', '', (sku or '').upper().strip())

def extract_familia_num(sku):
    m2 = re.match(r'^[A-Z]+-(\d+)', norm_sku(sku))
    return m2.group(1) if m2 else None

def extract_sufixo(sku):
    m2 = re.match(r'^[A-Z]+-\d+(.*)', norm_sku(sku))
    return m2.group(1) if m2 else ''

def find_custo_planilha(prod):
    """Busca o custo na planilha para um produto. Retorna dados ou None."""
    sku_b = norm_sku(prod['sku'] or '')
    fnum = extract_familia_num(sku_b)
    suf_b = extract_sufixo(sku_b)

    # 1. Match direto
    if sku_b in planilha_skus:
        return planilha_skus[sku_b], 'direto'

    # 2. Troca de prefixo
    prefix = sku_b[:3]; suf = sku_b[3:]
    for alt in PREFIX_ALTS.get(prefix, []):
        alt_sku = norm_sku(alt + suf)
        if alt_sku in planilha_skus:
            return planilha_skus[alt_sku], f'prefixo {prefix}→{alt}'

    # 3. Família + sufixo idêntico (todos os prefixos)
    if fnum:
        for sku_p, dados in planilha_skus.items():
            fp = extract_familia_num(sku_p)
            if fp == fnum and extract_sufixo(sku_p) == suf_b and suf_b:
                return dados, f'família {fnum}+sufixo'

    # 4. Família + sufixo parcial (últimos 6)
    if fnum:
        s6 = suf_b[-6:] if len(suf_b) >= 6 else suf_b
        for sku_p, dados in planilha_skus.items():
            fp = extract_familia_num(sku_p)
            if fp == fnum:
                sp = extract_sufixo(sku_p)
                sp6 = sp[-6:] if len(sp) >= 6 else sp
                if s6 and s6 == sp6:
                    return dados, f'família {fnum}+sufixo6'

    # 5. Família com custo único
    if fnum and fnum in plan_by_familia:
        items = plan_by_familia[fnum]
        custos = set(round(d['custo'], 2) for _, d in items)
        if len(custos) == 1:
            return items[0][1], f'família {fnum} único custo'

    return None, None

# ─── Processar produtos ───────────────────────────────────────────────────────
atualizados_sem_custo = 0
atualizados_inconsistentes = 0
sem_match = []
log_inconsistentes = []

for prod in nao_perfis:
    sku_b = norm_sku(prod['sku'] or '')
    prod_id = prod['id']
    custo_vals = get_custo_vals(prod)
    
    # Determinar quais campos de custo são aplicáveis (driver existe e não é N/A)
    campos_aplicaveis = []
    for cf, pf, mf in zip(CUSTO_FIELDS, MKP_PAD_FIELDS, MKP_MIN_FIELDS):
        # Verificar se o driver correspondente existe no produto
        driver_field = cf.replace('custoCorpo', 'driver').replace('Onoff220v', 'Onoff220').replace('OnoffBivolt', 'OnoffBivolt').replace('Dim110v', 'Dim110v').replace('DimDali', 'DimDali').replace('DimTriac110v', 'DimTriac110v').replace('DimTriac220v', 'DimTriac220v')
        # Simplificar: verificar se não é N/A
        nao_aplic_field = NAO_APLIC.get(cf)
        if nao_aplic_field and prod.get(nao_aplic_field):
            continue  # Driver marcado como N/A, pular
        campos_aplicaveis.append((cf, pf, mf))

    # Caso 1: produto sem custo — buscar na planilha
    if not custo_vals:
        dados, metodo = find_custo_planilha(prod)
        if dados:
            custo = round(dados['custo'], 4)
            mkp_p = round(dados['mkp_padrao'], 4) if dados.get('mkp_padrao') else None
            mkp_m = round(dados['mkp_minimo'], 4) if dados.get('mkp_minimo') else None
            update = {}
            for cf, pf, mf in campos_aplicaveis:
                update[cf] = str(custo)
                if mkp_p: update[pf] = str(mkp_p)
                if mkp_m: update[mf] = str(mkp_m)
            if update:
                set_clause = ', '.join([f"`{k}` = %s" for k in update.keys()])
                cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s", list(update.values()) + [prod_id])
                atualizados_sem_custo += 1
        else:
            sem_match.append(prod)
        continue

    # Caso 2: produto com custo — verificar se todos os campos aplicáveis têm o mesmo valor
    # Pegar o custo de referência da planilha (se disponível) ou o primeiro valor não-zero
    dados, metodo = find_custo_planilha(prod)
    if dados:
        custo_ref = round(dados['custo'], 4)
        mkp_p_ref = round(dados['mkp_padrao'], 4) if dados.get('mkp_padrao') else None
        mkp_m_ref = round(dados['mkp_minimo'], 4) if dados.get('mkp_minimo') else None
    else:
        # Usar o primeiro valor não-zero como referência
        custo_ref = custo_vals[0] if custo_vals else None
        mkp_p_ref = None; mkp_m_ref = None

    if not custo_ref:
        continue

    # Verificar se há inconsistência
    inconsistente = False
    for cf, pf, mf in campos_aplicaveis:
        v = prod.get(cf)
        if v is not None:
            try:
                fv = round(float(v), 4)
                if fv > 0 and abs(fv - custo_ref) > 0.01:
                    inconsistente = True
                    break
            except: pass
        # Campo aplicável mas sem valor
        elif custo_ref:
            inconsistente = True

    if inconsistente or any(
        prod.get(cf) is None or (prod.get(cf) is not None and float(prod.get(cf) or 0) == 0)
        for cf, pf, mf in campos_aplicaveis
    ):
        # Corrigir: preencher todos os campos aplicáveis com o custo de referência
        update = {}
        for cf, pf, mf in campos_aplicaveis:
            update[cf] = str(custo_ref)
            if mkp_p_ref: update[pf] = str(mkp_p_ref)
            if mkp_m_ref: update[mf] = str(mkp_m_ref)
        if update:
            set_clause = ', '.join([f"`{k}` = %s" for k in update.keys()])
            cursor.execute(f"UPDATE products SET {set_clause} WHERE id = %s", list(update.values()) + [prod_id])
            atualizados_inconsistentes += 1
            if inconsistente:
                log_inconsistentes.append(f"  {prod['sku']:<32} custo_ref={custo_ref:.4f} vals_antes={sorted(set(custo_vals))}")

conn.commit()
conn.close()

print(f"\n{'='*60}")
print(f"RESULTADO:")
print(f"  Produtos sem custo preenchidos: {atualizados_sem_custo}")
print(f"  Produtos com custo inconsistente corrigidos: {atualizados_inconsistentes}")
print(f"  Sem match na planilha: {len(sem_match)}")
print(f"{'='*60}")

if log_inconsistentes:
    print(f"\n=== INCONSISTÊNCIAS CORRIGIDAS ===")
    for l in log_inconsistentes[:30]:
        print(l)

print(f"\n=== SEM MATCH ({len(sem_match)}) ===")
for prod in sem_match[:20]:
    print(f"  {prod['sku']:<32} {prod['produto'][:50]}")
if len(sem_match) > 20:
    print(f"  ... +{len(sem_match)-20} mais")
