-- Atualização v61 — quantidade de módulos LED por CCT em Perfis.
-- Idempotente: somente produtos elegíveis e com quantidade divergente são tocados.
-- A condição de disponibilidade preserva CCTs vazios ou não aplicáveis.

UPDATE products AS p
JOIN (
  SELECT
    id,
    CAST(
      REPLACE(
        TRIM(TRAILING 'B' FROM REGEXP_SUBSTR(UPPER(produto), '[0-9]+([.][0-9]+)?B')),
        ',',
        '.'
      ) AS DECIMAL(10,2)
    ) * CASE
      WHEN UPPER(produto) LIKE '%36W SF%' OR potencia = '36W-SF' THEN 2
      ELSE 1
    END AS quantidade_calculada
  FROM products
  WHERE UPPER(TRIM(categoria)) = 'PERFIS'
    AND (
      UPPER(CONCAT_WS(' ', moduloLed, moduloLed2700, moduloLed3000, moduloLed3500, moduloLed4000, moduloLed5000)) LIKE '%STRIPFLEX%'
      OR UPPER(CONCAT_WS(' ', moduloLed, moduloLed2700, moduloLed3000, moduloLed3500, moduloLed4000, moduloLed5000)) LIKE '%STRIPLINE%'
    )
    AND UPPER(CONCAT_WS(' ', moduloLed, moduloLed2700, moduloLed3000, moduloLed3500, moduloLed4000, moduloLed5000)) NOT LIKE '%FITA LED%'
    AND REGEXP_SUBSTR(UPPER(produto), '[0-9]+([.][0-9]+)?B') IS NOT NULL
) AS regra ON regra.id = p.id
SET
  p.qtdModuloLed = CASE WHEN NULLIF(TRIM(p.moduloLed), '') IS NOT NULL AND UPPER(TRIM(p.moduloLed)) NOT IN ('NÃO APLICÁVEL', 'NAO APLICAVEL') THEN regra.quantidade_calculada ELSE p.qtdModuloLed END,
  p.qtdModuloLed2700 = CASE WHEN NULLIF(TRIM(p.moduloLed2700), '') IS NOT NULL AND UPPER(TRIM(p.moduloLed2700)) NOT IN ('NÃO APLICÁVEL', 'NAO APLICAVEL') THEN regra.quantidade_calculada ELSE p.qtdModuloLed2700 END,
  p.qtdModuloLed3000 = CASE WHEN NULLIF(TRIM(p.moduloLed3000), '') IS NOT NULL AND UPPER(TRIM(p.moduloLed3000)) NOT IN ('NÃO APLICÁVEL', 'NAO APLICAVEL') THEN regra.quantidade_calculada ELSE p.qtdModuloLed3000 END,
  p.qtdModuloLed3500 = CASE WHEN NULLIF(TRIM(p.moduloLed3500), '') IS NOT NULL AND UPPER(TRIM(p.moduloLed3500)) NOT IN ('NÃO APLICÁVEL', 'NAO APLICAVEL') THEN regra.quantidade_calculada ELSE p.qtdModuloLed3500 END,
  p.qtdModuloLed4000 = CASE WHEN NULLIF(TRIM(p.moduloLed4000), '') IS NOT NULL AND UPPER(TRIM(p.moduloLed4000)) NOT IN ('NÃO APLICÁVEL', 'NAO APLICAVEL') THEN regra.quantidade_calculada ELSE p.qtdModuloLed4000 END,
  p.qtdModuloLed5000 = CASE WHEN NULLIF(TRIM(p.moduloLed5000), '') IS NOT NULL AND UPPER(TRIM(p.moduloLed5000)) NOT IN ('NÃO APLICÁVEL', 'NAO APLICAVEL') THEN regra.quantidade_calculada ELSE p.qtdModuloLed5000 END
WHERE
  (NULLIF(TRIM(p.moduloLed), '') IS NOT NULL AND NOT (p.qtdModuloLed <=> regra.quantidade_calculada))
  OR (NULLIF(TRIM(p.moduloLed2700), '') IS NOT NULL AND NOT (p.qtdModuloLed2700 <=> regra.quantidade_calculada))
  OR (NULLIF(TRIM(p.moduloLed3000), '') IS NOT NULL AND NOT (p.qtdModuloLed3000 <=> regra.quantidade_calculada))
  OR (NULLIF(TRIM(p.moduloLed3500), '') IS NOT NULL AND NOT (p.qtdModuloLed3500 <=> regra.quantidade_calculada))
  OR (NULLIF(TRIM(p.moduloLed4000), '') IS NOT NULL AND NOT (p.qtdModuloLed4000 <=> regra.quantidade_calculada))
  OR (NULLIF(TRIM(p.moduloLed5000), '') IS NOT NULL AND NOT (p.qtdModuloLed5000 <=> regra.quantidade_calculada));
