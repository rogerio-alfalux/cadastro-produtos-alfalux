# Auditoria Visual de Fotos — Painéis

Data: 2026-08-12

| Produto/Família | Foto no banco | Resultado visual |
|---|---|---|
| ALS-3462 LED 36W QS (ALS-3462) | `/manus-storage/ALS-3462_d388fedb.png` | Painel quadrado preto, condizente com a família ALS-3462. |
| ORBIT S Ø400/600/800/1000/1200 | `/manus-storage/ORBITS_494a5982.png` | Painel circular preto, condizente com a família ORBIT S. |

Conclusão parcial: os dois registros não compartilham a mesma imagem e as imagens visualizadas correspondem às geometrias esperadas (quadrada para ALS-3462 e circular para ORBIT S).

## Inventário completo

Foi gerada uma folha de contato com as 52 combinações de família/foto atualmente cadastradas para produtos da categoria PAINÉIS. A revisão visual não identificou divergências evidentes entre o formato do produto e sua família: painéis quadrados/retangulares, lineares, circulares e decorativos apresentam imagens compatíveis com suas respectivas famílias. Também foi validado que nenhuma foto está associada a famílias distintas no banco.

**Ação corretiva:** não necessária; os mapeamentos atuais estão consistentes.

## Exceção aprovada pelo usuário

Os produtos ativos **ALS-2142 18W RTG** (`LLS-2142.618.19F`) e **ALS-2142 36W RTG** (`LLS-2142.124.19F`) permanecem intencionalmente sem foto. A ausência foi confirmada com o usuário em 2026-08-12; nenhuma foto substituta deve ser aplicada até nova orientação.

## Validação da API pública

A resposta local de `/api/products/all` contém 107 produtos ativos da categoria PAINÉIS. Todos os produtos de Painéis retornam `fotoUrl` exceto as duas referências ALS-2142 aprovadas acima. Não há produtos ativos com ausência inesperada de foto.

As diferenças entre algumas linhas do inventário e o retorno por SKU são decorrentes de SKUs compartilhados entre variantes, itens inativos e normalizações do endpoint público; a validação de integridade foi feita pela presença de foto em cada produto ativo retornado, sem excluir qualquer SKU da API.

## Revisão do inventário regenerado

A folha de contato foi regenerada preservando o par real de produto e foto de cada registro. A revisão visual abrangeu as 52 imagens: grades, painéis lineares, retangulares, quadrados, circulares, decorativos e trilhos mantêm geometria compatível com as famílias identificadas no inventário. Nenhuma substituição de foto foi necessária.
