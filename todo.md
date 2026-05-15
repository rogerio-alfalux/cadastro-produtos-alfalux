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
- [ ] Cadastrar produtos de perfis (aguardando definição da lógica de drivers)

## Melhorias v2 — Custo por Driver
- [x] Schema: adicionar custoOnoff220, custoOnoffBivolt, custoDim110v, custoDimDali (decimal, nullable)
- [x] Schema: remover custoDriver genérico, mantendo custoLuminaria
- [x] DB helpers: atualizar createProduct, updateProduct para novos campos
- [x] Router: atualizar schema Zod para novos campos de custo
- [x] Exportação Excel: incluir colunas de custo por driver
- [x] Importação Excel: mapear colunas de custo por driver
- [x] Frontend: custo embutido inline ao lado de cada campo de driver
- [x] Remover seção separada de "Custo" do formulário
