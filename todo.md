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
- [x] Auditar fotoUrl entre ALS-3462 e ORBIT S Ø800mm: registros distintos, imagens visualmente condizentes e API retornando as chaves corretas; nenhuma correção de mapeamento necessária
- [ ] Auditar individualmente as 52 combinações família/foto de PAINÉIS e registrar o resultado por item em `references/auditoria-fotos-paineis-detalhada.md`
- [x] Conciliar inventário ↔ API: 48 pares ativos com foto correspondentes, 4 pares inativos fora da API e 2 exceções ALS-2142 aprovadas sem foto
- [x] Manter sem foto, por decisão do usuário, os produtos ALS-2142 18W RTG e ALS-2142 36W RTG

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
- [x] Endpoint /api/products/all: incluir drivers extras na resposta para o Configurador (campos por tipo e alias agrupado `driversExtras`, com modelo, código EQ, quantidade e custo)

## Feature v31 — Múltiplas óticas (primária + secundárias)
- [x] Schema Drizzle: coluna oticaExtra (JSON array [{modelo, qtd}]) disponível
- [x] Migração SQL aplicada
- [x] Router tRPC: oticaExtra aceito no productSchema e persistido em criação/edição
- [x] ProductForm: botão "+ Adicionar ótica" abaixo da ótica primária
- [x] Cada ótica extra tem: ComponentSelect e campo Qtd
- [x] Botão de remover ótica extra (lixeira)
- [x] Migração de dados: 56 produtos com óticas secundárias estruturadas
- [x] API retorna ótica primária, secundária e campo legado consolidado corretamente

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

## Feature v37 — Duplicar Acessório

- [x] Botão "Duplicar" (ícone de copiar) em cada linha da tabela de acessórios
- [x] Ao clicar em Duplicar, abre o formulário pré-preenchido com todos os dados do item original
- [x] Campo Código limpo ao duplicar (forçar novo código único)
- [x] Banner de aviso no topo do formulário indicando "DUPLICANDO A PARTIR DE: [NOME DO PRODUTO]"
- [x] Ao salvar, cria um novo registro (não edita o original)
- [x] Liberar a Geysa para inserir e editar produtos, componentes, drivers, fontes, revenda e acessórios sem bloqueios indevidos de login ou perfil.
- [x] Validar código duplicado em Componentes: bloquear salvamento e emitir aviso se o código já existir no banco (frontend + backend).
- [x] Adicionar categorias de driver DIM TRIAC 110V e DIM TRIAC 220V ao enum de tipos de componentes.
- [x] Criar importação em massa de componentes via Excel (upload, preview, confirmação, inserção).
- [x] Criar família de produtos LED BAR 45 (DA, DB, DC) replicando estrutura da LED BAR U com novas fotos e SKUs corretos.
- [ ] Exclusão em massa de componentes: checkboxes na listagem, botão "Excluir Selecionados" e confirmação dupla antes de deletar.
- [ ] Expor campo codigo (EQ) dos componentes na API pública para o configurador.

## Feature v30 — Exclusão em Massa de Componentes
- [x] Checkboxes por linha na tabela de componentes (coluna extra à esquerda)
- [x] Checkbox de seleção de grupo no cabeçalho de cada tipo (seleciona/deseleciona todos do grupo)
- [x] Barra flutuante na parte inferior com contador de selecionados, botão "Limpar seleção" e botão "Excluir selecionados"
- [x] Double-check: primeiro modal de confirmação com aviso de irreversibilidade
- [x] Double-check: segundo modal de confirmação final antes de executar a exclusão
- [x] Mutation `components.deleteMany` com invalidação de cache após exclusão

## Feature v31 — Código EQ via lookup na tabela components
- [x] Endpoint /api/products/all agora busca o campo `codigo` da tabela `components` para cada driver
- [x] Lookup por modelo (uppercase) → codigo cadastrado na tabela components
- [x] Fallback: se o driver não estiver na tabela, usa regex extractEqCode para extrair o código do nome
- [x] Sem quebra de compatibilidade: campo `code` no objeto driver continua sendo retornado normalmente

## Feature v32 — Drivers e fontes como acessórios na API
- [x] Endpoint /api/acessorios/all agora inclui todos os drivers e fontes da tabela `components` (tipos DRIVER_*) como itens adicionais
- [x] Cada driver é mapeado com: id prefixado "driver-{id}", source="driver", codigo=EQ, sku=EQ, produto=modelo, familia=tipo legível, custo, observacoes
- [x] Acessórios da tabela accessories recebem source="accessories" para distinção no Configurador
- [x] Sem quebra de compatibilidade: campos existentes mantidos, apenas adicionados source, custo e observacoes

## Feature v33 — Foto nos componentes
- [ ] Migrar schema: adicionar colunas fotoUrl e fotoKey na tabela components
- [ ] Endpoint POST /api/componentes/upload-foto para upload de imagem
- [ ] Endpoint DELETE /api/componentes/:id/foto para remover foto
- [ ] Procedure updateFoto no tRPC para salvar fotoUrl/fotoKey no banco
- [ ] UI: botão de câmera/upload na linha do componente (modal ou inline)
- [ ] UI: preview da foto com opção de remover
- [ ] API /api/acessorios/all: incluir fotoUrl assinada dos drivers/fontes

## Feature v33 — Foto nos componentes
- [x] Migrar schema: adicionar fotoUrl e fotoKey na tabela components
- [x] Endpoints de upload/remoção de foto no componentsRoutes.ts
- [x] UI de foto no Components.tsx (botão câmera/imagem por linha, modal com preview, upload, remoção)
- [x] Transmitir fotoUrl assinada dos drivers na API /api/acessorios/all

## Feature v34 — Drivers DIM TRIAC 110V e 220V nos produtos
- [ ] Schema: adicionar driverDimTriac110v, custoDimTriac110v, driverDimTriac220v, custoDimTriac220v na tabela products
- [ ] Backend: atualizar Zod schema, db helpers, routers tRPC
- [ ] API /api/products/all: incluir campos DIM TRIAC 110V e 220V
- [ ] Frontend ProductForm: adicionar campos DIM TRIAC 110V e 220V na seção Drivers
- [ ] Frontend ProductList/modal de visualização: exibir DIM TRIAC 110V e 220V

## Feature v34 — Drivers DIM TRIAC 110V e 220V nos produtos [x]
- [x] Schema: colunas driverDimTriac110v, driverDimTriac220v, custoDriverDimTriac110v, custoDriverDimTriac220v, qtd e NaoAplicavel
- [x] Migração SQL aplicada
- [x] Backend: Zod schemas (create + update), routers.ts, productRoutes.ts (/api/products/all)
- [x] Frontend: FormData, defaultForm, carregamento existingProduct, payload doSubmit, JSX DriverRow + DriverExtraRow
- [x] Todos os 75 testes passando

## Backup Diário
- [x] Tabela `backups` criada no banco (schema + SQL executado)
- [x] Handler do cron `/api/scheduled/backup` implementado
- [x] tRPC procedures: backups.list, backups.generate, backups.getDownloadUrl
- [x] Página /backups com listagem, estatísticas e download
- [x] Item BACKUPS adicionado na navegação
- [x] Cron diário registrado via manus-config schedule (ativo, executa às 3h UTC / meia-noite Brasília)

## Backup Expandido v2 — ZIP completo com tudo
- [x] Instalar biblioteca archiver para geração de ZIP no servidor
- [x] Expandir backupHandler.ts: gerar arquivo ZIP contendo backup.json (todos os dados), backup.sql (dump SQL com INSERTs), imagens_urls.txt (lista de todas as URLs de fotos)
- [x] Incluir tabela users no backup JSON (sem senhas/tokens sensíveis)
- [x] Incluir tabela backups no backup JSON
- [x] Atualizar página Backups.tsx: indicar que o arquivo baixado é um ZIP com múltiplos conteúdos
- [x] Atualizar routers.ts: content-type do download para application/zip
- [x] Testar geração manual do backup expandido

## Ajuste de Horário — Brasília (America/Sao_Paulo)
- [x] Verificar onde timestamps são exibidos no frontend
- [x] Garantir que datas sejam exibidas em UTC-3 / horário de Brasília em todas as páginas
- [x] Verificar configuração de timezone no servidor Express

## Campo "Corrente do Driver" no Cadastro de Produtos
- [x] Adicionar coluna `corrente_driver` (text, nullable) no schema drizzle e executar migração SQL
- [x] Atualizar server/db.ts para incluir o campo nas queries de produto
- [x] Atualizar server/routers.ts para incluir o campo no create/update de produtos
- [x] Atualizar ProductForm.tsx: mostrar campo apenas quando módulo NÃO for FITA LED e driver NÃO for "Sem Driver"
- [x] Implementar lógica de preenchimento automático no ProductForm com base nas regras de wattagem/tipo
- [x] Popular produtos existentes no banco com os valores corretos de corrente do driver (798 atualizados, 514 sem corrente)
- [x] Expor o campo no endpoint público /api/products/all e /api/products/:sku

## Melhoria v39 — Ocultar Corrente do Driver para FONTE 24V
- [x] Campo "Corrente do Driver" oculto quando qualquer driver do produto contém "FONTE 24V" no modelo
- [x] Cobre todos os tipos: ON/OFF 220V, BIVOLT, DIM 1-10V, DIM DALI, DIM TRIAC 110V, DIM TRIAC 220V

## Feature v38 — Modo "Luminária com Lâmpada"
- [x] Badge "LUM. C/ LÂMPADA" (âmbar) na seção Módulo LED — mutuamente exclusivo com RGBW
- [x] Campo `moduloLampada` (boolean) salvo no banco (schema + migração SQL já aplicada)
- [x] useEffect: quando moduloLampada=true, força semDriver=true e limpa temperaturasCor
- [x] Seção Temperatura de Cor desabilitada (opacity-50 + pointer-events-none) com mensagem âmbar "Não aplicável — luminária com lâmpada"
- [x] Campos CCT (2700K-5000K) ficam com opacity-40 e pointer-events-none quando moduloLampada ativo
- [x] Endpoint /api/products/all expõe moduloLampada, moduloLedRgbw e qtdModuloLedRgbw

## Feature v40 — Versões de Potência nos Perfis Modulares
- [x] Campo `potencia` adicionado ao schema e migrado no banco
- [x] Filtro de potência adicionado na página de produtos (18W, 26W, 36W-SF, 36W-SL)
- [x] 871 produtos renomeados para 18W
- [x] 871 produtos 26W criados (corrente 500mA, driver EQ00220/EQ00353, custo +3%)
- [x] 871 produtos 36W-SF criados (dobro de barras Stripflex, custo +8.5%)
- [x] 861 produtos 36W-SL criados (Stripline, só barras inteiras, custo +8.5%)
- [x] Novos produtos NÃO expostos no endpoint público ainda

## Substituição em Massa de Componentes v1
- [x] Endpoint tRPC `components.previewReplace`: recebe tipo, componenteAtual, componenteNovo, familiaFiltro opcional — retorna lista de produtos afetados com contagem
- [x] Endpoint tRPC `components.executeReplace`: executa a substituição em todos os produtos afetados (atualiza modelo, custo e extras JSON)
- [x] Frontend: página "Substituição em Massa" acessível no menu de navegação (/substituicao-em-massa)
- [x] Seleção do componente atual (ComponentSelect filtrado por tipo)
- [x] Seleção do componente substituto (ComponentSelect filtrado pelo mesmo tipo)
- [x] Filtro opcional por família de produto
- [x] Preview: lista de produtos que serão afetados com nome, SKU e família
- [x] Confirmação com botão de execução e feedback de quantos produtos foram alterados

## Correção de Markups — Valores Exatos
- [x] Corrigir markup HIT para 3,15 / 2,15 (313 produtos)
- [x] Corrigir markups BLAZE por subfamília: BLAZE E 2,75/2, BLAZE S 2,8/2, BLAZE A 2,8/2, BLAZE P 2,8/2, BLAZE H P 2,9/2, MINI BLAZE P 2,9/2, MINI BLAZE S 2,75/2 (1089 produtos)

## Bug Fix v41 — Campo "Corrente do Driver" perde valor ao salvar e reabrir
- [x] Causa raiz: `correnteInferidaRef.current` era `null` na primeira execução do useEffect de auto-inferência após carregar o produto existente, fazendo a proteção contra sobrescrita falhar
- [x] Correção: mover declaração de `correnteInferidaRef` para antes do useEffect de inicialização e inicializá-la com o valor do banco (`p.correnteDriver || ""`) ao carregar produto existente
- [x] Agora a proteção funciona: se o valor inferido for diferente do valor salvo pelo usuário, preserva o valor do usuário

## Bug Fix v42 — Campo "Corrente do Driver" preservado ao reabrir formulário

- [x] Substituir lógica de `correnteInferidaRef` por flag `correnteEditadaManualmenteRef`
- [x] No useEffect de inicialização: comparar valor do banco com valor inferido para detectar edição manual
- [x] No onChange do campo: setar flag como true quando usuário digitar
- [x] No useEffect de auto-inferência: retornar imediatamente se flag for true

## Bug Fix v43 — Foto do produto não salva ao remover/alterar

- [x] Causa: `fotoUrl: form.fotoUrl || undefined` enviava `undefined` quando foto era removida (string vazia), fazendo o servidor ignorar o campo no UPDATE
- [x] Correção: `fotoUrl: form.fotoUrl !== "" ? form.fotoUrl : null` — envia null explicitamente para limpar a foto no banco
- [x] Schema Zod do update atualizado para aceitar `z.string().nullable().optional()` em fotoUrl e fotoKey

## Feature v44 — Seleção granular de produtos na tela de Substituição

- [x] Após clicar em "Ver produtos afetados", exibir lista de produtos com checkboxes (todos marcados por padrão)
- [x] Permitir marcar/desmarcar produtos individuais ou usar "Selecionar todos / Desmarcar todos"
- [x] Botão "Aplicar substituição" só aplica nos produtos selecionados (não em todos)
- [x] Endpoint `components.executeReplace` atualizado para aceitar lista opcional de IDs específicos (`productIds`)
- [x] Se `productIds` não for passado, comportamento atual é mantido (substitui em todos)

## Feature v46 — Desativar/Ativar Produto

- [x] Adicionar coluna `ativo` (boolean, default true) no schema drizzle/schema.ts e migrar banco
- [x] Procedure `products.toggleAtivo` no servidor para alternar o estado instantaneamente
- [x] API pública /api/products/all filtra apenas produtos com ativo=true
- [x] Checkbox na coluna Ações da listagem para ativar/desativar com otimistic update
- [x] Filtro "Somente desativados" na barra de filtros da listagem
- [x] Produtos desativados exibidos com visual diferenciado (opacidade reduzida) na listagem
- [x] Ajuste das larguras das colunas para melhor legibilidade

## Feature v47 — Desativar/Ativar Componentes e Acessórios

- [x] Adicionar coluna `ativo` (boolean, default true) nas tabelas components e accessories
- [x] Procedure `components.toggleAtivo` e `accessories.toggleAtivo` no servidor
- [x] Checkbox na coluna Ações das listagens de Componentes e Acessórios
- [x] Filtro "Somente desativados" nas listagens de Componentes e Acessórios
- [x] Componentes/Acessórios desativados com visual diferenciado (opacidade reduzida)

## Feature v48 — Opção D1 + D2 para Perfis

- [x] Adicionar indicador booleano de opção D1 + D2 ao cadastro de produtos
- [x] Exibir caixa de seleção no formulário apenas para produtos da categoria Perfis
- [x] Persistir o indicador ao criar e editar produtos
- [x] Expor `possuiOpcaoD1D2` na API pública de produtos
- [x] Validar cadastro, edição e resposta da API para produto de Perfil

## Ajuste v48.1 — Simplificação da Opção D1 + D2

- [x] Mover a caixa de seleção D1 + D2 para uma área visível na edição de Perfis
- [x] Remover do formulário as seções e campos de preço/custo específicos de D1 + D2
- [x] Marcar `possuiOpcaoD1D2 = true` em todos os Perfis das famílias HIT, EASY H PLUS e BLAZE H
- [x] Validar a resposta da API para os perfis atualizados

## Feature v49 — Composição D1+D2 para Perfis

- [x] Schema: adicionar coluna JSON `composicaoD1D2` na tabela products (armazena módulo LED dobrado + drivers específicos)
- [x] Migração SQL aplicada
- [x] ProductForm: seção "Componentes D1+D2" visível quando possuiOpcaoD1D2=true
- [x] Módulo LED D1+D2: mesmo modelo da versão D1, quantidade automática = 2x qtdModuloLed
- [x] Drivers D1+D2: cadastro manual (modelo + quantidade + custo) — não é necessariamente o dobro
- [x] Backend: persistir composicaoD1D2 no create/update de produtos
- [x] API pública: expor composicaoD1D2 na resposta de /api/products/all
- [x] Aplicar composição D1+D2 automaticamente nos 702 produtos HIT, EASY H PLUS e BLAZE H (dobrar barras, recalcular drivers)
- [x] Testes e validação

## Ajuste v49.2 — Nomes das Variações de Potência dos Perfis

- [x] Auditar os nomes de Perfis Modulares com potência repetida ou incorreta
- [x] Normalizar os nomes: 18W, 26W, 36W SF e 36W SL sem potência residual
- [x] Validar contagens, exemplos por família e resposta da API pública

## Ajuste v49.1 — Custos dos Drivers D1+D2

- [x] Preencher os custos dos drivers já cadastrados na composição D1+D2 a partir do cadastro de Componentes
- [x] Garantir que o formulário exiba os custos existentes ao editar os Perfis com D1+D2
- [x] Validar os custos na API pública para todos os Perfis com opção D1+D2

## Ajuste v49.3 — Dimensionamento de Drivers D1+D2

- [x] Auditar o caso LLP-4450.2ML.48F e as regras D1 de dimensionamento por barras
- [x] Gerar prévia de correções e criar a configuração D1+D2 faltante para pendentes e arandelas EASY H PLUS, BLAZE H, HIT e SHARP
- [x] Corrigir somente os drivers D1+D2 confirmados, preservando os demais componentes
- [x] Validar exemplos, resposta da API e custos dos drivers corrigidos
- [x] Aplicar a regra confirmada: driver 65W/60W atende até 8 barras D1+D2; acima desse limite, distribuir a quantidade de drivers por grupos de até 8 barras

## Exportação v50 — Custo e Markups ON/OFF 220Vac

- [x] Extrair todos os produtos com custo, markup padrão e markup mínimo ON/OFF 220Vac
- [x] Calcular preços de venda pelos markups padrão e mínimo, mantendo produtos sem custo na lista
- [x] Gerar e validar planilha Excel para entrega

## Ajuste v50.1 — Estética da Planilha de Markups

- [x] Aplicar faixas coloridas alternadas e destaque visual aos status e campos financeiros
- [x] Melhorar cabeçalhos, filtros, congelamento e legibilidade da planilha
- [x] Validar e reenviar a versão visual aprimorada

## Feature v51 — Módulo LED 3500K

- [x] Adicionar campo de módulo LED 3500K ao banco de produtos
- [x] Adicionar seleção e quantidade de módulo LED 3500K no formulário
- [x] Persistir 3500K em criação, edição, importação e exportação de produtos
- [x] Expor o módulo LED 3500K com código EQ/CP na API pública
- [x] Validar o fluxo completo de cadastro e API

## Melhoria v52 — Filtros de Família e Potência

- [x] Adicionar filtro de Família com as famílias disponíveis na listagem de Produtos
- [x] Aplicar o filtro de Família na consulta de produtos
- [x] Exibir o filtro de Potência somente quando a categoria selecionada for PERFIS
- [x] Limpar o filtro de Potência automaticamente ao trocar de PERFIS para outra categoria
- [x] Reorganizar a barra de filtros com proporções e quebra responsiva harmoniosas
- [x] Validar filtros combinados e a aparência em larguras diferentes

## Acesso v53 — Administração Completa para Geysa

- [x] Localizar a conta da Geysa e confirmar o perfil atual
- [x] Confirmar perfil administrativo completo para operações de cadastro e gestão
- [x] Validar a permissão administrativa no banco

## Diagnóstico v53.1 — Acesso da Geysa ao Configurador

- [x] Confirmar que a tela exibida pertence ao Configurador e não ao Cadastro de Produtos
- [x] Verificar que o Configurador possui login e permissões independentes do Cadastro
- [x] Orientar Geysa sobre o endereço correto e a autenticação complementar necessária

## Bug Fix v53.2 — Salvamento bloqueado por markup mínimo

- [x] Identificar que o backend rejeitava qualquer campo de markup mínimo enviado por não-admin, mesmo sem mudança
- [x] Permitir salvar o valor bloqueado de markup mínimo quando igual ao valor existente, mantendo bloqueio para mudanças reais
- [x] Validar criação e edição com testes de usuário comum e perfil administrativo

## Bug Fix v53.3 — CCT exibido sem módulo LED

- [x] Identificar que a listagem usava `temperaturasCor` sem verificar o módulo LED associado
- [x] Ocultar todos os CCTs quando não houver módulo LED cadastrado
- [x] Validar a listagem com módulos genéricos, módulos por CCT e ausência de módulo

## Feature v54 — CCT Extra em Módulos LED

- [x] Adicionar estrutura de CCTs extras ao schema e ao banco
- [x] Adicionar botão e linhas editáveis de CCT extra no formulário de produtos
- [x] Persistir CCT extra com temperatura, módulo LED e quantidade em criação/edição
- [x] Expor CCTs extras na API pública sem alterar os cinco CCTs padrão
- [x] Validar o fluxo completo e a remoção de CCTs extras

## Exportação de Migração — Dump Completo do Banco

- [x] Inventariar todas as tabelas e suas contagens em modo somente leitura
- [x] Gerar dump MySQL completo com CREATE TABLE e INSERT INTO para todas as tabelas
- [x] Verificar a integridade básica do arquivo e entregar para download
- [x] Informar de modo seguro o estado da URL e da conexão externa do banco

## Feature v55 — Documentos do Produto

- [x] Adicionar persistência para Datasheet, Fotometria IES e Desenho Técnico por produto
- [x] Criar endpoints seguros para upload e remoção dos três tipos de documento
- [x] Adicionar área compacta de documentos no topo do cadastro/edição do produto
- [x] Preservar e carregar documentos existentes ao editar ou duplicar produtos
- [x] Adicionar coluna Documentos com indicadores DS, IES e DT na listagem geral
- [x] Expor URLs assinadas e metadados dos documentos na API pública de produtos
- [x] Cobrir criação, edição, remoção e resposta da API com testes
- [x] Validar TypeScript, suíte Vitest e interface responsiva antes do checkpoint

## Verificação v55.1 — Publicação da API de Documentos

- [x] Confirmar que `/api/products/all` retorna `documentos` e os três aliases de URL
- [x] Disponibilizar o checkpoint validado para publicação em produção

## Correção v55.2 — Falha de Implantação

- [x] Reproduzir o build de produção e identificar a etapa que falhou
- [x] Confirmar que não havia erro de código, dependência, migração ou empacotamento a corrigir
- [x] Validar testes, TypeScript, build e inicialização em modo de produção
- [x] Criar checkpoint corrigido e informar a causa da falha

## Correção v55.3 — Corrente ZEUS 17W 24° TRL

- [x] Comparar a corrente cadastrada com as respostas local e publicada da API
- [x] Confirmar que não há divergência no Cadastro/API e que nenhuma correção de código é necessária
- [x] Garantir que `/api/products/all` envie 500mA para o produto correto
- [x] Validar a resposta publicada e registrar o diagnóstico

## Correção v55.4 — URLs Assinadas de Documentos

- [x] Reproduzir o HTTP 403 nos documentos do produto LDE-6450.140.18B
- [x] Identificar a divergência entre chave armazenada e assinatura CloudFront/S3
- [x] Corrigir a geração privada de URLs para Datasheet, Fotometria IES e Desenho Técnico
- [x] Preservar o contrato `documentos` e os três aliases de URL na API pública
- [x] Validar por GET cada URL disponível com HTTP 200/206 e conteúdo correto
- [x] Adicionar testes de regressão para assinatura e compatibilidade de documentos
- [x] Validar TypeScript, Vitest, build e criar checkpoint para publicação

## Feature v56 — Usuários, Login e Permissões

- [x] Mapear autenticação, usuários atuais e todas as operações sensíveis do sistema
- [x] Adicionar perfis Admin, Engenharia e Custos ao modelo de usuários
- [x] Implementar credenciais locais com senha forte armazenada somente como hash
- [x] Restringir novos usuários ao domínio grupoalfalux, exceto o administrador proprietário
- [x] Criar login por e-mail e senha com sessão segura e logout
- [x] Criar painel exclusivo de administradores para incluir, editar, ativar e excluir usuários
- [x] Garantir acesso total somente aos administradores proprietário e Geysa
- [x] Permitir à Engenharia gerenciar documentos sem visualizar ou alterar custos e preços
- [x] Permitir a Custos visualizar e alterar somente custos e markups
- [x] Restringir criação e exclusão de produtos, componentes, acessórios e revenda a administradores
- [x] Ocultar na interface campos, páginas e ações sem permissão
- [x] Aplicar as mesmas restrições no backend, independentemente da interface
- [x] Adicionar testes por perfil para login, domínio, documentos, custos e operações administrativas
- [x] Validar migração, TypeScript, Vitest, build e fluxos visuais antes do checkpoint
