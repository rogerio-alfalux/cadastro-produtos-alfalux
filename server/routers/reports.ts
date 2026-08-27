import { z } from "zod";
import { listProducts } from "../db";
import { reportProcedure, router } from "../_core/trpc";
import { calculateOnOff220Financials, calculateReportMetrics, getReportFilterOptions } from "../reporting";

const filtersSchema = z.object({
  search: z.string().trim().max(160).optional(),
  categoria: z.string().trim().max(80).optional(),
  instalacao: z.string().trim().max(80).optional(),
  familia: z.string().trim().max(160).optional(),
  potencia: z.string().trim().max(20).optional(),
  apenasInativos: z.boolean().optional(),
}).optional();

export const reportsRouter = router({
  filterOptions: reportProcedure.input(filtersSchema).query(async ({ input }) => {
    const { items } = await listProducts({ limit: 5000, offset: 0 });
    return getReportFilterOptions(items, input ?? {});
  }),
  summary: reportProcedure.input(filtersSchema).query(async ({ input }) => {
    const { items } = await listProducts({
      ...(input ?? {}),
      limit: 5000,
      offset: 0,
    });
    return {
      metrics: calculateReportMetrics(items),
      items: items.slice(0, 50).map((item) => ({
        id: item.id,
        produto: item.produto,
        sku: item.sku,
        familia: item.familia,
        categoria: item.categoria,
        ativo: item.ativo,
        ...calculateOnOff220Financials(item),
      })),
    };
  }),
});
