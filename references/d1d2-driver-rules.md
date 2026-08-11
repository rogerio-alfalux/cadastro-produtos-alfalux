# Regra de Cálculo de Drivers D1+D2

## Contexto
Perfis com opção D1+D2 dobram a quantidade de barras.
A versão D1+D2 usa o mesmo módulo LED, mas com 2x a quantidade de barras.
Os drivers são recalculados com base na quantidade total de barras D1+D2.

## Regra de Escalonamento de Drivers (18W / 350mA)

| Barras D1+D2 | Driver 220V | Driver Bivolt |
|---|---|---|
| 2 (1B×2) | XITANIUM 44W 200-350MA 70-125VDC DIP SWITCH 230V | 40W 200-350MA 45-130VDC BIV DIP SWITCH SLIM |
| 4 (2B×2) | XITANIUM 65W 200-350MA 120-185VDC DS 230V | 60W 200-350MA 80-200VDC BIV DIP SWITCH SLIM |
| 6+ (3B+×2) | XITANIUM 65W 200-350MA 120-185VDC DS 230V | 60W 200-350MA 80-200VDC BIV DIP SWITCH SLIM |

## Modelos Completos (usados no banco)
- 19W 220V: `LED DRIVER XITANIUM 19W 200-350MA 30-54VDC DS 230V`
- 19W BIV: `LED DRIVER 20W 200-350MA 27-75VDC BIV DIP SWITCH SLIM`
- 44W 220V: `LED DRIVER XITANIUM 44W 200-350MA 70-125VDC DIP SWITCH 230V`
- 44W BIV: `LED DRIVER 40W 200-350MA 45-130VDC BIV DIP SWITCH SLIM`
- 65W 220V: `LED DRIVER XITANIUM 65W 200-350MA 120-185VDC DS 230V`
- 65W BIV: `LED DRIVER 60W 200-350MA 80-200VDC BIV DIP SWITCH SLIM`

## Lógica de Cálculo
1. Extrair quantidade de barras do nome do produto (regex: `(\d+\.?\d*)B`)
2. Dobrar a quantidade para D1+D2
3. Calcular potência total = barras_d1d2 × 18W (ou 26W conforme potencia)
4. Selecionar driver:
   - Potência total ≤ 19W → driver 19W/20W
   - Potência total ≤ 44W → driver 44W/40W
   - Potência total > 44W → driver 65W/60W

## Potência 26W (500mA)
- 1B 26W: `LED DRIVER 20W 500MA 30-40VDC I 230V` (sem bivolt)
- 2B+ 26W: `LED DRIVER 75W 350-550MA 90-216VDC 220V SLIM` (sem bivolt)

## Famílias Afetadas
- HIT: 313 produtos
- EASY H PLUS: 290 produtos
- BLAZE H: 99 produtos
- Total: 702 produtos
