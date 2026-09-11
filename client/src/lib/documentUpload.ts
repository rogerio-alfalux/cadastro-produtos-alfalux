export type DocumentUploadType = "datasheet" | "fotometria" | "desenhoTecnico" | "manualInstalacao";

export type UploadedProductDocument = {
  url: string;
  key: string;
  nome: string;
  mimeType: string;
};

const TRANSIENT_STATUS = new Set([408, 429, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function readResponsePayload(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}

export function describeDocumentUploadFailure(status: number, payload: Record<string, unknown>): string {
  if (status === 413) return "O arquivo ultrapassa o limite permitido de 25 MB.";
  if (TRANSIENT_STATUS.has(status)) return "O serviço de arquivos está temporariamente indisponível. Aguarde alguns segundos e tente novamente.";
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  return status >= 400 ? "Não foi possível concluir o envio do documento." : "Resposta inválida durante o envio do documento.";
}

class DocumentUploadError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

async function uploadThroughApplication(type: DocumentUploadType, file: File): Promise<{
  documento: UploadedProductDocument;
  documentoVisualizacao: UploadedProductDocument;
}> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120_000);
  try {
    const body = new FormData();
    body.append("tipo", type);
    body.append("file", file);
    const response = await fetch("/api/products/upload-document", { method: "POST", body, signal: controller.signal });
    const payload = await readResponsePayload(response);
    if (!response.ok || !payload.documento) {
      throw new DocumentUploadError(
        describeDocumentUploadFailure(response.status, payload),
        TRANSIENT_STATUS.has(response.status),
      );
    }
    const documento = payload.documento as UploadedProductDocument;
    return {
      documento,
      documentoVisualizacao: (payload.documentoVisualizacao as UploadedProductDocument | undefined) ?? documento,
    };
  } catch (error) {
    if (error instanceof DocumentUploadError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new DocumentUploadError("O envio demorou mais que o esperado. Verifique a conexão e tente novamente.", true);
    }
    throw new DocumentUploadError("Não foi possível comunicar com o serviço de arquivos. Tente novamente em alguns segundos.", true);
  } finally {
    window.clearTimeout(timer);
  }
}

export async function uploadProductDocumentResilient(type: DocumentUploadType, file: File): Promise<{
  documento: UploadedProductDocument;
  documentoVisualizacao: UploadedProductDocument;
}> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await uploadThroughApplication(type, file);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof DocumentUploadError && error.retryable;
      if (!retryable || attempt === 2) break;
      await sleep(750 * (attempt + 1));
    }
  }
  if (lastError instanceof DocumentUploadError && lastError.retryable) {
    throw new Error(`${lastError.message} O sistema tentou automaticamente 3 vezes; nenhum documento foi vinculado ao produto.`);
  }
  throw lastError instanceof Error ? lastError : new Error("Não foi possível concluir o envio do documento.");
}
