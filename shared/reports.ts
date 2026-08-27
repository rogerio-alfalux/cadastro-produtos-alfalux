export const REPORT_SECTION_KEYS = ["technical", "drivers", "financial", "documents"] as const;
export type ReportSection = typeof REPORT_SECTION_KEYS[number];

export const REPORT_SECTION_LABELS: Record<ReportSection, string> = {
  technical: "Dados técnicos",
  drivers: "Drivers",
  financial: "Custos, markups e preços",
  documents: "Documentos",
};
