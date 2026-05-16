# Integração: Cadastro de Produtos → Configurador de Produtos Alfalux

## Visão Geral

O **Cadastro de Produtos Alfalux** expõe um endpoint público que o Configurador deve consumir para obter os dados de produtos em tempo real.

---

## Endpoint Público do Cadastro

```
GET https://alfaluxprod-c8zmg2fn.manus.space/api/products/all
```

- **Sem autenticação** — acesso público, CORS liberado
- **Sem cache** — sempre retorna os dados mais atuais do banco
- **Formato JSON** — compatível com a estrutura que o Configurador já usa

### Exemplo de resposta

```json
{
  "count": 211,
  "available": 211,
  "updatedAt": "2026-05-16T02:00:00.000Z",
  "products": [
    {
      "instalacao": "EMBUTIR",
      "familia": "LUNA",
      "sku": "LDE 1400.120.19B",
      "name": "LUNA PP LED 6,5W RE ABS",
      "categoria": "DOWNLIGHTS",
      "holder": null,
      "otica": null,
      "dissipador": null,
      "ledModule": "TRACE CIRCULAR 6 LEDS Ø50MM",
      "fotoUrl": null,
      "temperaturasCor": ["2700", "3000", "4000", "5000"],
      "driver220": { "model": "LIFUD 13W 350MA BIVOLT", "code": null },
      "driverBivolt": { "model": "LIFUD 13W 350MA BIVOLT", "code": null },
      "driverDim110v": null,
      "driverDimDali": null,
      "custoLuminaria": null,
      "custoDriver220": null,
      "custoDriverBivolt": null,
      "custoDriverDim110v": null,
      "custoDriverDimDali": null
    }
  ]
}
```

---

## O que precisa ser modificado no Configurador

O Configurador tem dois endpoints tRPC no router `led`:

### 1. `led.drivers` — Query que carrega os dados

Atualmente este endpoint retorna dados **hardcoded** no bundle. Precisa ser alterado para buscar do Cadastro:

```typescript
// server/routers/led.ts (ou onde estiver o router led)

import { publicProcedure } from "./_core/trpc";

// Substitua o retorno hardcoded por:
drivers: publicProcedure.query(async () => {
  try {
    const response = await fetch(
      "https://alfaluxprod-c8zmg2fn.manus.space/api/products/all",
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error("Falha ao buscar produtos");
    const data = await response.json();
    return {
      count: data.count,
      available: data.available,
      products: data.products,
      updatedAt: data.updatedAt,
    };
  } catch (err) {
    console.error("[led.drivers] Erro ao buscar do Cadastro:", err);
    // Retornar array vazio em caso de falha para não quebrar o Configurador
    return { count: 0, available: 0, products: [], updatedAt: new Date().toISOString() };
  }
}),
```

### 2. `led.refreshDrivers` — Mutation do botão "Atualizar banco de drivers"

Este mutation pode simplesmente invalidar o cache da query `led.drivers`. Como o endpoint do Cadastro já retorna dados frescos sem cache, basta retornar o count atualizado:

```typescript
refreshDrivers: publicProcedure.mutation(async () => {
  try {
    const response = await fetch(
      "https://alfaluxprod-c8zmg2fn.manus.space/api/products/all",
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error("Falha ao buscar produtos");
    const data = await response.json();
    return { count: data.count, available: data.available };
  } catch (err) {
    console.error("[led.refreshDrivers] Erro:", err);
    return { count: 0, available: 0 };
  }
}),
```

---

## Como o Configurador usa os dados (mapeamento de campos)

O Configurador já usa exatamente estes campos nos objetos de produto:

| Campo no Configurador | Campo no Cadastro | Notas |
|---|---|---|
| `instalacao` | `instalacao` | Ex: "EMBUTIR", "SOBREPOR" |
| `familia` | `familia` | Ex: "LUNA", "ZEUS" |
| `sku` | `sku` | Código do produto |
| `name` | `name` (= `produto`) | Nome completo |
| `holder` | `holder` | `null` se Não Aplicável |
| `otica` | `otica` | `null` se Não Aplicável |
| `dissipador` | `dissipador` | `null` se Não Aplicável |
| `ledModule` | `ledModule` (= `moduloLed`) | Módulo LED |
| `driver220` | `driver220` | `{ model, code }` ou `null` |
| `driverBivolt` | `driverBivolt` | `{ model, code }` ou `null` |
| `driverDim110v` | `driverDim110v` | `{ model, code }` ou `null` |
| `driverDimDali` | `driverDimDali` | `{ model, code }` ou `null` |

---

## Fluxo de atualização em tempo real

```
Usuário cadastra/edita produto no Cadastro
         ↓
Banco de dados do Cadastro atualizado imediatamente
         ↓
Configurador chama led.drivers.useQuery() com staleTime=3600s
         ↓ (ou usuário clica "Atualizar banco de drivers")
Configurador chama led.refreshDrivers.useMutation()
         ↓
Configurador invalida o cache de led.drivers
         ↓
Configurador re-busca GET /api/products/all do Cadastro
         ↓
Dados atualizados aparecem no Configurador
```

---

## URL do Cadastro de Produtos (produção)

```
https://alfaluxprod-c8zmg2fn.manus.space
```

Endpoint de integração:
```
https://alfaluxprod-c8zmg2fn.manus.space/api/products/all
```
