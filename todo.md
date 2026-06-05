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

## Feature v23 — Módulo de Operações em Massa

### Alteração em Massa de Custos
- [x] Endpoint tRPC `bulkOps.previewCostLuminaria` + `bulkOps.applyCostLuminaria`: alterar custo de luminária em massa (filtros: família, categoria, módulo LED contém)
- [x] Endpoint tRPC `bulkOps.previewCostDriver` + `bulkOps.applyCostDriver`: alterar custo de driver específico em massa (filtros: família, categoria, tipo de driver, modelo do driver)
- [x] Frontend: aba "Custo da Luminária" na página de Operações em Massa
  - [x] Filtros por família/categoria/módulo LED + campo novo valor + prévia de quantos produtos serão afetados
  - [x] Confirmação antes de aplicar com resumo do impacto
- [x] Frontend: aba "Custo de Driver" na página de Operações em Massa
  - [x] Filtros por família/categoria/tipo de driver/modelo do driver + campo novo valor + prévia
  - [x] Confirmação antes de aplicar com resumo do impacto

### Gestão de Drivers em Massa
- [x] Endpoint tRPC `bulkOps.previewDriver` + `bulkOps.applyDriver`: inserir ou remover driver em massa (filtros: família, categoria, módulo LED parcial, driver atual)
- [x] Frontend: aba "Gestão de Drivers" na página de Operações em Massa
  - [x] Filtros: família, categoria, tipo de driver (ON/OFF 220V, BIVOLT, DIM 1-10V, DIM DALI), modelo do driver atual (opcional), módulo LED contém
  - [x] Ação: Inserir driver (campo modelo + custo opcional) ou Remover driver
  - [x] Prévia: lista de produtos que serão afetados antes de confirmar
  - [x] Confirmação e feedback de quantos produtos foram alterados

### Infraestrutura
- [x] Adicionar rota `/operacoes-em-massa` no App.tsx
- [x] Adicionar link "EM MASSA" no menu de navegação
- [x] Testes vitest para os novos endpoints (22 testes passando em bulkOps.test.ts)

## Bug Fix v22 — ComponentSelect perde foco após cada caractere digitado
- [x] Causa raiz: FieldWrapper e DriverRow eram definidos DENTRO do ProductForm — a cada setField() o React os recriava como novos componentes, desmontando o DOM e destruindo o foco
- [x] Correção: FieldWrapper e DriverRow extraídos para fora do ProductForm com interfaces de props explícitas; todas as dependências passadas via props

## Bug Fix v21 — ComponentSelect: foco instável e cursor sai após digitar uma letra
- [x] Causa 1: div wrapper com onClick={handleOpen} interceptava cliques e chamava setTimeout(focus,50), roubando o foco do input nativo
- [x] Causa 2: displayValue = open ? search : value causava re-render ao mudar open, interrompendo a digitação
- [x] Causa 3: onFocus={() => setOpen(true)} disparava re-render que podia mover o foco
- [x] Solução: reescrita completa com estado inputValue local sincronizado com value, sem div wrapper, sem setTimeout, com suppressBlurRef para evitar fechamento prematuro do dropdown

## Bug Fix v20 — Campos de digitação livre bloqueados no formulário de edição
- [x] Causa: ComponentSelect.handleOpen() resetava search para "" ao clicar no campo, apagando o texto existente e impedindo edição
- [x] Correção: handleOpen() agora inicializa search com o valor atual (value || "") e seleciona todo o texto para facilitar substituição

## Fotos Painéis v1 — Upload e atualização de fotos de 23 famílias de painéis
- [x] Upload das 23 imagens para o storage webdev (23/23 com sucesso)
- [x] 49 produtos de painéis atualizados com foto correta
- [ ] LUMIGRID E e LUMIGRID S ainda sem foto (não foram enviadas fotos para essas famílias)

## Varredura Completa v1 — Corrigir todos os produtos com campos divergentes da planilha
- [x] Extrair todos os produtos da planilha (DOWNLIGHTS + PAÍNÉIS) — 208 produtos
- [x] Comparar com banco e identificar todos os produtos com campos errados — 189 divergentes em 30 famílias
- [x] Corrigir todos os 189 produtos divergentes (módulo LED, drivers, holder, ótica, dissipador, SKU)
- [x] Limpar holder/ótica/dissipador de todos os 51 PAINÉIS (esses campos não existem em painéis)
- [x] Office Comfort: moduloLed e drivers corrigidos, holder/ótica limpados

## Bug Fix v19 — Categoria SPOTS não retorna resultados no Configurador
- [ ] Verificar como os produtos SPOTS estão cadastrados no banco (campo categoria)
- [ ] Verificar como o endpoint /api/products/all retorna os SPOTS
- [ ] Corrigir o campo categoria dos produtos SPOTS se necessário

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

## Melhorias v24 — Componentes, Drivers e Alteração em Massa
- [x] Corrigir aba Componentes para exibir todos os 221 componentes do banco (incluindo os importados via planilha)
- [x] Adicionar campo de quantidade de driver por tipo no ProductForm (default 1, afeta ON/OFF 220V, BIVOLT, DIM 1-10V, DIM DALI)
- [x] Salvar quantidade de driver no banco (schema + migração SQL aplicada)
- [x] Implementar alteração em massa de componente: substituir um componente em todos os produtos que o utilizam
  - [x] Autocomplete no campo "Componente Atual" com sugestões do banco (por tipo)
  - [x] Autocomplete no campo "Novo Componente" com sugestões do banco
  - [x] Prévia dos produtos afetados antes de confirmar
  - [x] Filtro opcional por família
  - [x] Suporte a todos os tipos: Módulo LED, Ótica, Holder, Dissipador, Driver ON/OFF 220V, Driver BIVOLT, Driver DIM 1-10V, Driver DIM DALI

## Feature v25 — Quantidade de componentes (Módulo LED, Ótica, Holder, Dissipador)
- [x] Schema Drizzle: adicionar qtdModuloLed, qtdOtica, qtdHolder, qtdDissipador (int, default 1)
- [x] Migração SQL aplicada via webdev_execute_sql
- [x] Router tRPC: adicionar campos ao productSchema e bulkProductSchema
- [x] ProductForm: campo de quantidade ao lado de Módulo LED, Ótica, Holder e Dissipador
- [x] Campo de quantidade só aparece quando o componente não está marcado como NÃO APLICÁVEL
- [x] Carregamento dos valores do banco ao editar produto

## Feature v26 — Ver produtos que usam um componente
- [x] Endpoint tRPC `components.getProductsUsing`: retorna lista de produtos que usam um componente pelo modelo/tipo
- [x] Botão de lupa/olho em cada linha da tabela de componentes
- [x] Modal "Produtos que usam este componente" com tabela: Produto, SKU, Família
- [x] Loading state no modal enquanto carrega
- [x] Mensagem de "nenhum produto" quando count = 0

## Feature v27 — Múltiplos drivers por tipo
- [x] Schema Drizzle: adicionar colunas JSON para drivers extras (driverOnoff220Extra, driverOnoffBivoltExtra, driverDim110vExtra, driverDimDaliExtra) — array de {modelo, qtd, custo}
- [x] Migração SQL aplicada
- [x] Router tRPC: adicionar campos extras ao productSchema e db helpers
- [x] ProductForm: botão "+ Adicionar driver" por tipo, recolhido por padrão
- [x] Cada driver extra tem: ComponentSelect, campo Qtd e campo Custo
- [x] Botão de remover driver extra (X)
- [ ] Endpoint /api/products/all: incluir drivers extras na resposta para o Configurador (pendente)

## Feature v31 — Múltiplas óticas (primária + secundárias)
- [ ] Schema Drizzle: adicionar coluna oticaExtra (JSON array [{modelo, qtd}])
- [ ] Migração SQL aplicada
- [ ] Router tRPC: adicionar oticaExtra ao productSchema
- [ ] ProductForm: botão "+ Adicionar ótica" abaixo da ótica primária
- [ ] Cada ótica extra tem: ComponentSelect e campo Qtd
- [ ] Botão de remover ótica extra (lixeira)
- [ ] Migração de dados: separar valores compostos "LENTE X + NxLOUVER Y" em primária + extras
- [ ] API continua retornando dados corretamente

## Feature v30 — Categoria REVENDA
- [x] Criar tabela `revenda_products` no banco (id, codigo, descricao, referencia, fornecedor, observacoes, fotoUrl, fotoKey, custo, precoVenda, createdAt, updatedAt)
- [x] Criar router tRPC `revenda` com procedures: list, listFornecedores, create, update, delete
- [x] Criar endpoint público GET /api/revenda/all para o Configurador
- [x] Criar página /revenda com listagem, busca, filtro por fornecedor e CRUD completo
- [x] Adicionar link REVENDA no menu de navegação
- [x] Importar 201 itens da planilha ITENSDEREVENDA.xlsx para o banco
- [x] Testes vitest para a tabela revenda_products (5 testes passando)

## Feature v31 — Preços de Revenda
- [x] Importar custos da planilha ITENSDEREVENDA-PREÇO(02.06.2026).xlsx para o campo `custo`
- [x] Calcular preço de venda com fórmulas: REVOLUZ = custo × (1+IPI) × (1+ST) × 1,6; demais = base × 1,6
- [x] Base de cálculo = "VALOR FINAL S/FRETE" se preenchido, senão "VALOR"
- [x] 79 itens com custo e preço de venda calculado; 122 sem preço na planilha (precoVenda=null)
- [x] Endpoint /api/revenda/all retorna apenas precoVenda calculado (sem custo interno)
- [x] Formulário de revenda calcula preço de venda automaticamente ao digitar custo

## Feature v32 — Upgrade Revenda: Novos Preços + Imagens
- [x] Atualizar preços com planilha ITENSDEREVENDA-PREÇO(03.06.2026).xlsx (104 itens com preço)
- [x] Inserir 15 novos produtos da nova planilha (total: 216 produtos)
- [x] Upload de 54 imagens JPG para o storage webdev
- [x] Associar fotoUrl a cada produto no banco
- [x] Exibir thumbnail na tabela de revenda (clique para ampliar)

## Feature v33 — Gerenciamento de foto nos produtos de revenda

- [x] Adicionar endpoint REST /api/revenda/upload-foto (upload via multipart → storage S3)
- [x] Adicionar endpoint REST DELETE /api/revenda/:id/foto (remove fotoUrl do banco)
- [x] Atualizar UI da página Revenda.tsx com área de upload drag-and-drop e botão de remover foto

## Feature v34 — Categoria Acessórios

- [ ] Criar tabela `accessories` no schema Drizzle com campos: id, codigo, sku, produto, familia, dimensao, fotoUrl, fotoKey, custo, precoVenda, createdAt, updatedAt
- [ ] Executar migration SQL no banco
- [ ] Criar router tRPC com procedures: list, create, update, delete
- [ ] Criar endpoint público GET /api/acessorios/all com CORS aberto
- [ ] Criar endpoint POST /api/acessorios/upload-foto para upload de imagem
- [ ] Criar endpoint DELETE /api/acessorios/:id/foto para remover foto
- [ ] Criar página Acessorios.tsx com listagem, busca, filtro por família e CRUD completo
- [ ] Adicionar rota /acessorios no App.tsx
- [ ] Adicionar item ACESSÓRIOS no menu de navegação
- [ ] Escrever testes unitários para o router de acessórios

## Feature v35 — Categoria Acessórios

- [x] Tabela `accessories` criada no banco (codigo, sku, produto, familia, dimensao, fotoUrl, fotoKey, custo, precoVenda)
- [x] Router tRPC `accessories` com list, listFamilias, getById, create, update, delete
- [x] Endpoint público GET /api/acessorios/all (CORS aberto, URLs S3 assinadas)
- [x] Endpoint POST /api/acessorios/upload-foto (upload de imagem para S3)
- [x] Endpoint DELETE /api/acessorios/:id/foto (remover foto)
- [x] Página Accessories.tsx com tabela, filtro por família, busca e CRUD completo
- [x] Item ACESSÓRIOS adicionado na navegação (AlfaluxLayout)
- [x] Rota /acessorios registrada no App.tsx
- [x] Testes unitários (3 testes passando — total 48 testes)

## Feature v36 — Campo Observações em Acessórios

- [x] Coluna `observacoes` adicionada à tabela `accessories` via ALTER TABLE
- [x] Campo `observacoes` adicionado ao schema Drizzle (drizzle/schema.ts)
- [x] Campo `observacoes` adicionado ao schema Zod do router (server/routers/accessories.ts)
- [x] Campo `observacoes` incluído nas operações create e update do router
- [x] Campo `observacoes` adicionado ao tipo AccessoryItem, emptyForm, openEdit e handleSubmit (Accessories.tsx)
- [x] Textarea de observações adicionada ao formulário de criação/edição de acessórios
- [x] 48 testes passando
