import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token")?.trim() ?? "", []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const status = trpc.auth.passwordResetStatus.useQuery(
    { token: token || "link-ausente" },
    { enabled: Boolean(token), retry: false },
  );
  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha definida com sucesso. Entre com suas novas credenciais.");
      navigate("/login");
    },
    onError: (error) => toast.error(error.message),
  });

  const invalid = !token || status.isError;
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmation) {
      toast.error("As senhas não coincidem.");
      return;
    }
    resetPassword.mutate({ token, password });
  };

  return (
    <main className="min-h-screen bg-background text-foreground grid place-items-center p-5 sm:p-8">
      <section className="w-full max-w-md alfalux-card p-6 sm:p-8">
        <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-6">
          <KeyRound className="w-5 h-5 text-primary" />
        </div>
        <p className="text-xs font-semibold tracking-[0.2em] text-primary">ALFALUX · ACESSO SEGURO</p>
        <h1 className="text-2xl font-semibold mt-2">Definir nova senha</h1>

        {status.isLoading && token ? (
          <div className="py-10 grid place-items-center gap-3 text-sm text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin text-primary" />Validando link seguro…</div>
        ) : invalid ? (
          <div className="mt-6 rounded-xl border border-destructive/35 bg-destructive/5 p-4">
            <p className="font-medium">Este link não está disponível.</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Ele pode ter expirado, já ter sido usado ou ter sido substituído por um link mais recente.</p>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-primary font-medium mt-4 hover:underline"><ArrowLeft className="w-4 h-4" />Voltar ao login</Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Crie uma senha nova para acessar o Cadastro de Produtos. Este link será invalidado assim que a senha for salva.</p>
            <form className="space-y-5 mt-7" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="reset-password">Nova senha</Label>
                <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-password-confirmation">Confirmar nova senha</Label>
                <Input id="reset-password-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">Use ao menos 12 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.</p>
              <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {resetPassword.isPending ? "SALVANDO…" : "DEFINIR NOVA SENHA"}
              </Button>
            </form>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-6 pt-5 border-t border-border/60"><ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />Link temporário, protegido por token e válido para um único uso.</div>
          </>
        )}
      </section>
    </main>
  );
}
