import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Download,
  RefreshCw,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  ShieldAlert,
  FileArchive,
  FileJson,
  FileCode2,
  Image,
  Info,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function BackupsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: backupList, isLoading, refetch } = trpc.backups.list.useQuery(undefined, {
    enabled: isAdmin,
  });

  const generateMutation = trpc.backups.generate.useMutation({
    onSuccess: () => {
      toast.success("Backup gerado com sucesso!");
      refetch();
    },
    onError: (err) => {
      toast.error(`Erro ao gerar backup: ${err.message}`);
    },
  });

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  async function handleDownload(id: number, filename: string) {
    setDownloadingId(id);
    try {
      const result = await utils.backups.getDownloadUrl.fetch({ id });
      const a = document.createElement("a");
      a.href = result.url;
      a.download = result.filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast.error(`Erro ao baixar backup: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <ShieldAlert className="w-12 h-12 text-destructive/60" />
        <p className="text-sm font-medium">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide text-foreground">BACKUPS DO SISTEMA</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Backups automáticos diários às 3h UTC (meia-noite horário de Brasília). Últimos 30 backups disponíveis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            ATUALIZAR
          </Button>
          <Button
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2 text-xs"
          >
            <Database className="w-3.5 h-3.5" />
            {generateMutation.isPending ? "GERANDO..." : "GERAR AGORA"}
          </Button>
        </div>
      </div>

      {/* Conteúdo do ZIP */}
      <Card className="border-border/40 bg-muted/5">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground flex items-center gap-2">
            <Info className="w-3.5 h-3.5" />
            CONTEÚDO DO BACKUP (arquivo .zip)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/10 border border-border/30">
              <FileJson className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-foreground">backup.json</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Todos os dados do banco: produtos, componentes, revenda, acessórios, usuários
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/10 border border-border/30">
              <FileCode2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-foreground">backup.sql</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Dump SQL com INSERT statements para restauração em MySQL/TiDB
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/10 border border-border/30">
              <Image className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-foreground">imagens_urls.txt</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Lista de todas as URLs de fotos de produtos, componentes e acessórios
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/10 border border-border/30">
              <FileArchive className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-foreground">README.txt</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Instruções de restauração e resumo do conteúdo do backup
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {backupList && backupList.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/40 bg-muted/10">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">TOTAL DE BACKUPS</div>
              <div className="text-2xl font-bold text-foreground">{backupList.length}</div>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-muted/10">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">ÚLTIMO BACKUP</div>
              <div className="text-sm font-semibold text-foreground">
                {formatDate(backupList[0].createdAt)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-muted/10">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">TAMANHO MÉDIO</div>
              <div className="text-2xl font-bold text-foreground">
                {formatBytes(
                  backupList.filter(b => b.status === "success").reduce((s, b) => s + b.sizeBytes, 0) /
                  Math.max(1, backupList.filter(b => b.status === "success").length)
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-muted/10">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">REGISTROS (ÚLTIMO)</div>
              <div className="text-2xl font-bold text-foreground">
                {backupList[0].counts
                  ? JSON.parse(backupList[0].counts).total?.toLocaleString("pt-BR") ?? "—"
                  : "—"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de backups */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground">
            HISTÓRICO DE BACKUPS
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !backupList || backupList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <HardDrive className="w-10 h-10 opacity-30" />
              <p className="text-sm">Nenhum backup encontrado.</p>
              <p className="text-xs opacity-60">Clique em "Gerar Agora" para criar o primeiro backup.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {backupList.map((backup) => {
                const counts = backup.counts ? JSON.parse(backup.counts) : null;
                const isZip = backup.filename.endsWith(".zip");
                return (
                  <div
                    key={backup.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {backup.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-foreground truncate">
                            {backup.filename}
                          </div>
                          {isZip && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-purple-500/40 text-purple-400">
                              ZIP
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(backup.createdAt)}
                          </span>
                          {backup.status === "success" && (
                            <>
                              <span className="text-xs text-muted-foreground">
                                {formatBytes(backup.sizeBytes)}
                              </span>
                              {counts && (
                                <span className="text-xs text-muted-foreground">
                                  {counts.total?.toLocaleString("pt-BR")} registros
                                  {counts.products !== undefined && (
                                    <span className="ml-1 opacity-60">
                                      ({counts.products} produtos · {counts.components} componentes
                                      {counts.accessories ? ` · ${counts.accessories} acessórios` : ""})
                                    </span>
                                  )}
                                </span>
                              )}
                            </>
                          )}
                          {backup.status === "error" && backup.errorMessage && (
                            <span className="text-xs text-destructive truncate max-w-xs">
                              {backup.errorMessage}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Badge
                        variant={backup.status === "success" ? "default" : "destructive"}
                        className="text-[10px] px-2"
                      >
                        {backup.status === "success" ? "OK" : "ERRO"}
                      </Badge>
                      {backup.status === "success" && backup.storageKey && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-7 px-3"
                          disabled={downloadingId === backup.id}
                          onClick={() => handleDownload(backup.id, backup.filename)}
                        >
                          <Download className="w-3 h-3" />
                          {downloadingId === backup.id ? "..." : isZip ? "BAIXAR ZIP" : "BAIXAR"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
