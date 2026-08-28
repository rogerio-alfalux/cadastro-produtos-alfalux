import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LockKeyhole, LogIn, ShieldCheck, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: async (result) => {
      // Atualiza a sessão no cache antes de navegar. Assim, o primeiro render
      // após o login não interpreta momentaneamente a sessão recém-criada como ausente.
      utils.auth.me.setData(undefined, result.user);
      await utils.auth.me.invalidate();
      toast.success("Acesso autorizado");
      navigate("/");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!loading && user) navigate("/");
  }, [loading, navigate, user]);

  return (
    <main className="min-h-screen bg-background text-foreground grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden lg:flex relative overflow-hidden border-r border-border/60 p-12 flex-col justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,122,255,0.18),transparent_38%),radial-gradient(circle_at_80%_80%,rgba(0,194,255,0.10),transparent_35%)]" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-bold tracking-wide">ALFALUX</p>
            <p className="text-xs tracking-[0.24em] text-muted-foreground">CADASTRO DE PRODUTOS</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-xs font-semibold tracking-[0.24em] text-primary mb-4">AMBIENTE INTERNO</p>
          <h1 className="text-4xl xl:text-5xl font-semibold leading-tight">Dados técnicos, custos e documentos sob controle.</h1>
          <p className="mt-5 text-muted-foreground leading-relaxed">O acesso é individual e as ações disponíveis são determinadas pelo perfil atribuído pelo administrador.</p>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Sessão protegida e permissões validadas no servidor
        </div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <Zap className="w-7 h-7 text-primary" />
            <span className="font-bold tracking-wide">ALFALUX</span>
          </div>
          <div className="alfalux-card p-6 sm:p-8">
            <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-6">
              <LockKeyhole className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold">Acessar o sistema</h2>
            <p className="text-sm text-muted-foreground mt-2">Use o e-mail e a senha definidos pelo administrador.</p>

            <form
              className="space-y-5 mt-7"
              onSubmit={(event) => {
                event.preventDefault();
                login.mutate({ email, password });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <Input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@grupoalfalux.com.br" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={login.isPending}>
                <LogIn className="w-4 h-4 mr-2" />
                {login.isPending ? "ENTRANDO..." : "ENTRAR"}
              </Button>
            </form>

            <p className="text-[11px] leading-relaxed text-muted-foreground mt-6 pt-5 border-t border-border/60 text-center">
              Use somente as credenciais definidas no painel de Usuários. Em caso de dificuldade, solicite a redefinição da senha a um administrador.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
