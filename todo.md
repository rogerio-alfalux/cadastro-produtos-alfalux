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
