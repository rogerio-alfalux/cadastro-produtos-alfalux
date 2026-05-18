# Cadastro de Produtos Alfalux — TODO

## Status: COMPLETO ✅

## Banco de Dados
- [x] Schema da tabela `products` com todos os campos
- [x] Migração SQL aplicada via webdev_execute_sql
- [x] Query helpers em server/db.ts

## Backend (tRPC)
- [x] Router `products.list` com filtros e busca
- [x] Router `products.getById`
- [x] Router `products.create` com validação
- [x] Router `products.update`
- [x] Router `products.delete`
- [x] Endpoint REST `/api/products/upload-image` para upload de foto
- [x] Endpoint REST `/api/products/export-excel` para exportação
- [x] Endpoint REST `/api/products/import-excel` para importação em massa
- [x] Router `products.bulkCreate` para importação via tRPC
- [x] Router `products.count` para contagem total
- [x] Router `products.getAll` para acesso completo pelo Configurador

## Frontend
- [x] Tema escuro Alfalux (index.css com paleta de cores da marca)
- [x] Layout AlfaluxLayout com header, breadcrumb e footer
- [x] Página de cadastro de produto (ProductForm)
- [x] Campos: Categoria, Instalação, Família, SKU, Produto, Módulo LED
- [x] Campos com checkbox "Não Aplicável": Ótica, Holder, Dissipador
- [x] Seção de Drivers/Controle (ON/OFF 220Vac, ON/OFF BIVOLT, DIM 1-10V, DIM DALI)
- [x] Checkboxes de temperatura de cor (2700K, 3000K, 4000K, 5000K) pré-marcados
- [x] Upload de foto do produto (JPEG, JPG, PNG)
- [x] Campos de custo (luminária e driver) em R$
- [x] Validação visual de campos obrigatórios com destaque em vermelho
- [x] Botão "Cadastrar Produto" azul (habilitado apenas com campos válidos)
- [x] Página de listagem de produtos com busca e filtros
- [x] Modal de edição de produto
- [x] Modal de visualização de produto
- [x] Confirmação de exclusão de produto
- [x] Botão de exportação Excel
- [x] Botão de importação Excel em massa

## Dados Iniciais
- [x] Script de seed para importar 208 produtos do Excel existente
- [x] Seed executado no banco de dados (208 produtos inseridos)

## Testes
- [x] Testes vitest para routers de produtos (9 testes passando)
- [x] Testes de validação dos campos obrigatórios
- [x] Teste de logout (existente)

## Melhorias v2 (solicitadas)
- [x] Reestruturar custo: cada driver deve ter seu próprio campo de custo ao lado
- [x] Atualizar schema do banco: adicionar colunas custoOnoff220, custoOnoffBivolt, custoDim110v, custoDimDali
- [x] Atualizar frontend: custo embutido inline ao lado de cada campo de driver
- [x] Atualizar exportação Excel para incluir custo por driver
- [x] Analisar planilha Excel para extrair dados de perfis
- [x] Cadastrar produtos de perfis (aguardando definição da lógica de drivers pelo usuário — será feito manualmente ou via importação Excel quando a lógica estiver definida)

## Melhorias v2 — Custo por Driver
- [x] Schema: adicionar custoOnoff220, custoOnoffBivolt, custoDim110v, custoDimDali (decimal, nullable)
- [x] Schema: remover custoDriver genérico, mantendo custoLuminaria
- [x] DB helpers: atualizar createProduct, updateProduct para novos campos
- [x] Router: atualizar schema Zod para novos campos de custo
- [x] Exportação Excel: incluir colunas de custo por driver
- [x] Importação Excel: mapear colunas de custo por driver
- [x] Frontend: custo embutido inline ao lado de cada campo de driver
- [x] Remover seção separada de "Custo" do formulário

## Melhorias v3 — Formulário
- [x] Corrigir validação: campos com "Não Aplicável" marcado devem ser considerados preenchidos
- [x] Criar componente AutocompleteInput com sugestões dos valores já cadastrados
- [x] Aplicar autocomplete nos campos: Família, Produto, Módulo LED, Ótica, Holder, Dissipador, Drivers
- [x] Corrigir bug do cursor: Delete/Backspace não deve tirar o foco do campo

## Melhorias v4 — Drivers Não Aplicável
- [x] Schema: adicionar colunas driverOnoffBivoltNaoAplicavel, driverDim110vNaoAplicavel, driverDimDaliNaoAplicavel (boolean)
- [x] Backend: atualizar Zod schema e db helpers para os novos campos
- [x] Frontend: adicionar checkbox "NÃO APLICÁVEL" ao lado de ON/OFF BIVOLT, DIM 1-10V e DIM DALI
- [x] Validação: ON/OFF BIVOLT obrigatório apenas se não marcado como Não Aplicável
- [x] DIM 1-10V e DIM DALI: já eram opcionais, mas agora com checkbox explícito
- [x] Atualizar testes

## Bugs v5 — Formulário
- [x] Bug: DISSIPADOR preenchido ainda aparece como campo obrigatório faltando (stale state)
- [x] Bug: AutocompleteInput trava cursor ao digitar/apagar — só aceita 1 caractere por vez

## Funcionalidade v6 — Duplicar Produto
- [x] Botão "Duplicar" na linha de cada produto na listagem (ícone de copiar ao lado de editar/excluir)
- [x] Botão "Duplicar" no modal de visualização do produto
- [x] Modal de duplicação abre formulário pré-preenchido com dados do produto original
- [x] SKU limpo ao duplicar (campo obrigatório vazio para forçar novo código)
- [x] PRODUTO limpo ao duplicar (para forçar novo nome)
- [x] Banner de aviso no topo do formulário indicando "DUPLICANDO A PARTIR DE: [NOME DO PRODUTO ORIGINAL]"
- [x] Todos os outros campos pré-preenchidos: categoria, instalação, família, módulo LED, ótica, holder, dissipador, drivers, temperaturas, custos, foto

## Integração v7 — Configurador de Produtos
- [x] Expor endpoint público GET /api/products/all no Cadastro para o Configurador consumir
- [x] Documentar mudanças necessárias no Configurador (led.drivers e led.refreshDrivers) em INTEGRACAO_CONFIGURADOR.md
- [x] Testar endpoint /api/products/all — retornando 211 produtos corretamente
- [x] Salvar checkpoint do Cadastro com endpoint público

## Importação v8 — Suporte à planilha do Configurador (Perfis)
- [x] Adaptar endpoint /api/products/import-excel para detectar e importar planilha no formato "Módulos de Perfis" (cabeçalho na linha 4, dados a partir da linha 6, linhas de seção ▶ ignoradas)
- [x] Mapear campos: Código (SKU) → sku, Nome do Produto → produto, Família → familia, Categoria → categoria, Tipo de Instalação → instalacao, Modelo Driver (220V) → driverOnoff220, Modelo Driver (Bivolt) → driverOnoffBivolt, Potência+Tipo de Barra+Corrente → moduloLed
- [x] Ignorar linhas de seção (▶) e linhas sem SKU
- [x] Testar importação com a planilha alfalux_perfis_modulos_v2.xlsx (897 SKUs esperados)
- [x] Adaptar endpoint /api/products/import-excel para detectar e importar planilha no formato "Módulos de Perfis"
- [x] Mapear campos: Código (SKU) → sku, Nome do Produto → produto, Família → familia, Categoria → categoria, Tipo de Instalação → instalacao, Modelo Driver (220V) → driverOnoff220, Modelo Driver (Bivolt) → driverOnoffBivolt, Potência+Tipo de Barra+Corrente → moduloLed
- [x] Ignorar linhas de seção (▶) e abas auxiliares (Resumo, Tabela de Drivers, Legenda)
- [x] Testar importação com a planilha alfalux_perfis_modulos_v2.xlsx — 897 SKUs importados corretamente
- [x] Limpar registros inválidos do banco gerados por importações de teste anteriores

## Bugs e Melhorias v9
- [x] Corrigir filtro de categoria: selecionar "PERFIS LINEARES LED" mostra lista vazia
- [x] Remover duplicatas do banco (perfis duplicados)
- [x] Implementar anti-duplicidade na importação Excel (ignorar SKUs já existentes)

## Anti-duplicidade v2 — Chave composta SKU + Ótica
- [x] Remover UNIQUE constraint do SKU no banco
- [x] Criar UNIQUE constraint composta (sku, otica) no banco
- [x] Atualizar schema Drizzle para refletir a nova constraint
- [x] Atualizar bulkInsertProducts para deduplicar por SKU+Ótica (INSERT IGNORE)
- [x] Limpar duplicatas reais do banco usando a nova chave composta
- [x] Restaurar os 3 Spots com SKU correto LDS-2300.1CO.01B
- [x] Atualizar testes para cobrir reimportação com variantes (mesmo SKU, óticas diferentes)

## Correções v10 — Categoria e Fotos de Perfis
- [x] Renomear categoria "PERFIS LINEARES LED" → "PERFIS" no banco (UPDATE)
- [x] Atualizar constante CATEGORIAS no frontend (ProductList, ProductForm) para "PERFIS"
- [x] Atualizar importador Excel para mapear "PERFIS LINEARES LED" → "PERFIS"
- [x] Corrigir campo categoria vazio no formulário de edição de perfis
- [x] Fazer upload das 33 fotos de perfis para o storage e associar ao banco (739 produtos)
- [x] Associar fotos das famílias FLOW (6), SMART MINI (120) e SOFT (26) — aguardando imagens do usuário (pendente de envio)

## Fotos v11 — Downlights e Painéis
- [x] Fazer upload das 87 fotos de Downlights e Painéis para o storage
- [x] Mapear e associar fotos aos produtos no banco por SKU/nome do produto (65/65 DL, 36/38 Painéis, 3/3 Spots)

## Bug Fix v12 — Digitação de um caractere por vez
- [x] Corrigir bug de digitação no ProductForm: campos travam após cada caractere digitado (causa provável: re-render por query invalidation ou referência instável no useQuery)

## Feature v12 — Tabela de Componentes
- [x] Criar tabela `components` no banco (id, tipo, modelo, codigo, observacao, createdAt)
- [x] Tipos: DRIVER_ONOFF_220, DRIVER_ONOFF_BIVOLT, DRIVER_DIM_110V, DRIVER_DIM_DALI, OTICA, HOLDER, DISSIPADOR, MODULO_LED
- [x] Criar endpoints tRPC: components.list, components.create, components.update, components.delete, components.bulkReplace, components.countUsage, components.families
- [x] Migrar dados existentes de drivers/óticas/holders/etc. do banco para a tabela components
- [x] Atualizar ProductForm para usar ComponentSelect (busca + seleção) de componentes por tipo
- [x] Manter compatibilidade: campo de texto livre ainda disponível se componente não estiver cadastrado

## Feature v12 — Alteração em Massa de Componentes
- [x] Criar página "Componentes" no menu lateral
- [x] Página "Componentes": listar, criar, editar e excluir componentes por tipo (agrupados)
- [x] Botão "Alteração em Massa": substituir componente em todos os produtos que o utilizam
- [x] Filtro por família: permitir restringir a substituição a uma família específica de produtos
- [x] Prévia antes de confirmar: mostrar quantos produtos serão afetados antes de aplicar

## Bug Fix v13 — Foto trocada ALE-3462 / ORBIT S
- [ ] Investigar e corrigir confusão de fotoUrl entre ALE-3462 e ORBIT S Ø800mm
- [ ] Verificar se outros produtos Painéis têm fotos trocadas

## Bug Fix v14 — Confusão de produtos no Configurador após update de componentes
- [ ] Identificar o que mudou no endpoint /api/products/all após o update de componentes
- [ ] Corrigir o problema que causou a confusão entre ALE-3462 e ORBIT S

## Bug Fix v18 — ALE-2118 sem módulo LED e LUMIGRID sem driver
- [x] ALE-2118: IDs 192, 194, 196 tinham moduloLed e driverOnoff220 vazios (dados estavam no campo errado: holder/otica). Corrigidos com valores exatos da planilha.
- [x] LUMIGRID E/S: IDs 163, 164 tinham driverOnoff220 e driverOnoffBivolt vazios. Corrigidos com '1X LIFUD 40W 1000MA BIVOLT (LF-GIF040YCII1000U) (EQ00496)'.

## Bug Fix v17 — Produtos FOCO retornam dados de outros produtos no Configurador
- [ ] Investigar por que FOCO P RE 4.5W retorna dados do FOCO G COB 70 RE 18W 60°
- [ ] Verificar se o problema é nos dados do banco (campos misturados) ou na lógica do Configurador
- [ ] Corrigir os dados incorretos no banco e/ou a lógica de busca

## Bug Fix v16 — Drivers DIM habilitados indevidamente ao salvar produto
- [x] Investigar causa: o payload do formulário sempre enviava driverDim110vNaoAplicavel=false, que o update procedure interpretava como "setar false no banco", sobrescrevendo o NULL original
- [x] Corrigir frontend: payload não envia campos DIM quando estão vazios e não marcados como NÃO APLICÁVEL
- [x] Corrigir backend: update procedure agora inclui tratamento dos campos NaoAplicavel (driverOnoffBivolt, driverDim110v, driverDimDali)
- [x] Limpar banco: 13 produtos FOCO afetados foram corrigidos (driverDim110v/driverDimDali voltaram para NULL/false)

## Bug Fix v15 — Problemas na família FOCO
- [x] Investigar e corrigir erro ao editar produtos FOCO — causa: schema Zod rejeitava null nos campos opcionais (driverDim110v, fotoUrl, custoLuminaria etc.); corrigido com z.string().nullish()
- [x] Atualizar fotos de todos os 156 downlights — 66 imagens enviadas, todas com upload e mapeamento correto para os produtos
- [x] Verificar se outros produtos com múltiplas variantes do mesmo SKU têm o mesmo problema — não, o bug era no schema Zod, não na constraint

## Anti-duplicidade v3 — Chave composta SKU + Nome do Produto
- [x] Alterar constraint de anti-duplicidade: de (sku, otica) para (sku, produto) no banco e schema Drizzle
- [x] Atualizar bulkInsertProducts para usar chave composta SKU+produto no INSERT IGNORE
- [x] Atualizar importador Excel para preservar nome do produto como chave de deduplicação
- [x] Importar todos os produtos faltantes da planilha DRIVER_LOOKUP (variantes FOCO, VIRGO, ORBITAL, etc.)
- [x] Verificar contagem final por família após importação — 1101 produtos (156 DL, 51 Painéis, 891 Perfis, 3 Spots)
