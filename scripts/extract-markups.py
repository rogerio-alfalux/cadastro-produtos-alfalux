import pandas as pd
import json

# Famílias sem markup
familias_sem_mkp = [
    "ALE-2423", "ALS-2142", "ALS-3103", "ALS-3140", "ALS-3462", "ALS-3750",
    "BAGEO SINUOSA E", "BLAZE", "BLAZE H", "EASY LED POINT", "EASY LED POINT S",
    "EASY PRIME", "FLOW", "HIT", "LEAVE", "LED BAR WW E", "LED BAR WW S",
    "LUNA SPOT", "MINI BAGEO S", "MINI ZEUS", "ORBITAL", "ORBITAL RE",
    "SHARP", "SKYLINE", "SMART MINI", "SOFT", "VEGA"
]

files = [
    "/home/ubuntu/upload/TabelavendasLuminárias25.06.26final.xlsx",
    "/home/ubuntu/upload/ALFALUX-TABELADEPREÇO22.06.26Vivian.xlsx",
    "/home/ubuntu/upload/ALFALUX-TABELAITENSADICIONAIS11.07.26.xlsx"
]

results = {}

for f in files:
    try:
        xl = pd.ExcelFile(f)
        for s in xl.sheet_names:
            df = xl.parse(s, header=None)
            # Procurar colunas com MKP PADRÃO e MKP MÍNIMO
            # Verificar se a primeira linha tem esses headers
            header_row = None
            for i in range(min(5, len(df))):
                row_vals = [str(v).upper().strip() if pd.notna(v) else "" for v in df.iloc[i]]
                if any("MKP" in v and "PADR" in v for v in row_vals):
                    header_row = i
                    break
            
            if header_row is None:
                continue
            
            # Encontrar índices das colunas
            headers = [str(v).upper().strip() if pd.notna(v) else "" for v in df.iloc[header_row]]
            desc_col = None
            mkp_padrao_col = None
            mkp_minimo_col = None
            
            for idx, h in enumerate(headers):
                if "DESCRI" in h or "PRODUTO" in h:
                    desc_col = idx
                elif "MKP" in h and "PADR" in h:
                    mkp_padrao_col = idx
                elif "MKP" in h and "MÍN" in h:
                    mkp_minimo_col = idx
            
            if desc_col is None:
                desc_col = 0
            if mkp_padrao_col is None:
                continue
            
            # Extrair dados
            for i in range(header_row + 1, len(df)):
                desc = str(df.iloc[i, desc_col]) if pd.notna(df.iloc[i, desc_col]) else ""
                mkp_p = df.iloc[i, mkp_padrao_col] if pd.notna(df.iloc[i, mkp_padrao_col]) else None
                mkp_m = df.iloc[i, mkp_minimo_col] if mkp_minimo_col is not None and pd.notna(df.iloc[i, mkp_minimo_col]) else None
                
                if not desc or mkp_p is None:
                    continue
                
                desc_upper = desc.upper()
                for fam in familias_sem_mkp:
                    fam_upper = fam.upper()
                    if fam_upper in desc_upper or fam_upper.replace("-", "").replace(" ", "") in desc_upper.replace("-", "").replace(" ", ""):
                        key = fam
                        if key not in results:
                            results[key] = {"mkp_padrao": [], "mkp_minimo": [], "exemplos": []}
                        try:
                            p = float(mkp_p)
                            results[key]["mkp_padrao"].append(p)
                            if mkp_m is not None:
                                results[key]["mkp_minimo"].append(float(mkp_m))
                            if len(results[key]["exemplos"]) < 2:
                                results[key]["exemplos"].append(desc[:80])
                        except:
                            pass
                        break
    except Exception as e:
        print(f"Erro em {f}: {e}")

# Resumo
print("\n" + "="*80)
print("MARKUPS ENCONTRADOS POR FAMÍLIA")
print("="*80)
for fam in familias_sem_mkp:
    if fam in results:
        data = results[fam]
        mkp_p_vals = data["mkp_padrao"]
        mkp_m_vals = data["mkp_minimo"]
        # Usar o valor mais comum (moda)
        from statistics import mode, StatisticsError
        try:
            mkp_p = mode(mkp_p_vals)
        except:
            mkp_p = mkp_p_vals[0] if mkp_p_vals else None
        try:
            mkp_m = mode(mkp_m_vals)
        except:
            mkp_m = mkp_m_vals[0] if mkp_m_vals else None
        
        print(f"{fam:25s} | Padrão: {mkp_p} | Mínimo: {mkp_m} | Qtd linhas: {len(mkp_p_vals)} | Ex: {data['exemplos'][0][:60] if data['exemplos'] else ''}")
    else:
        print(f"{fam:25s} | *** NÃO ENCONTRADO ***")

# Salvar JSON para uso posterior
output = {}
for fam in familias_sem_mkp:
    if fam in results:
        data = results[fam]
        mkp_p_vals = data["mkp_padrao"]
        mkp_m_vals = data["mkp_minimo"]
        from statistics import mode
        try:
            mkp_p = mode(mkp_p_vals)
        except:
            mkp_p = mkp_p_vals[0] if mkp_p_vals else None
        try:
            mkp_m = mode(mkp_m_vals)
        except:
            mkp_m = mkp_m_vals[0] if mkp_m_vals else None
        output[fam] = {"mkp_padrao": mkp_p, "mkp_minimo": mkp_m}

with open("/home/ubuntu/cadastro-produtos-alfalux/scripts/markups-found.json", "w") as f:
    json.dump(output, f, indent=2)
print("\nJSON salvo em scripts/markups-found.json")
