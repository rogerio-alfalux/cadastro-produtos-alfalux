import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import type { AppRole } from "@shared/permissions";
import {
  ArrowLeftRight,
  ChevronRight,
  Cpu,
  Database,
  FileStack,
  HardDrive,
  LayoutGrid,
  LogOut,
  Menu,
  PlusCircle,
  ShoppingCart,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { label: "PRODUTOS", href: "/", icon: Database, roles: ["admin", "engineering", "costs", "user"] },
  { label: "CADASTRAR", href: "/cadastrar", icon: PlusCircle, roles: ["admin"] },
  { label: "REVENDA", href: "/revenda", icon: ShoppingCart, roles: ["admin"] },
  { label: "ACESSÓRIOS", href: "/acessorios", icon: Wrench, roles: ["admin"] },
  { label: "COMPONENTES", href: "/componentes", icon: Cpu, roles: ["admin"] },
  { label: "SUBSTITUIÇÃO", href: "/substituicao-em-massa", icon: ArrowLeftRight, roles: ["admin"] },
  { label: "DOCS EM LOTE", href: "/documentos-em-massa", icon: FileStack, roles: ["admin"] },
  { label: "BACKUPS", href: "/backups", icon: HardDrive, roles: ["admin"] },
  { label: "USUÁRIOS", href: "/usuarios", icon: Users, roles: ["admin"] },
];

function breadcrumbLabel(location: string) {
  if (location === "/") return "PRODUTOS";
  if (location === "/cadastrar") return "CADASTRAR PRODUTO";
  if (location.startsWith("/documentos-em-massa")) return "DOCUMENTOS EM LOTE";
  if (location.startsWith("/documentos")) return "DOCUMENTOS";
  if (location.startsWith("/custos")) return "CUSTOS E MARKUPS";
  if (location.startsWith("/usuarios")) return "USUÁRIOS";
  if (location.startsWith("/revenda")) return "REVENDA";
  if (location.startsWith("/acessorios")) return "ACESSÓRIOS";
  if (location.startsWith("/componentes")) return "COMPONENTES";
  if (location.startsWith("/substituicao-em-massa")) return "SUBSTITUIÇÃO EM MASSA";
  if (location.startsWith("/backups")) return "BACKUPS";
  return "EDITAR PRODUTO";
}

export default function AlfaluxLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const visibleNavItems = navItems.filter((item) => user && item.roles.includes(user.role));

  const renderNavItem = (item: NavItem, mobile = false) => {
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={mobile ? () => setMobileOpen(false) : undefined}
        className={cn(
          mobile
            ? "flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wider transition-all"
            : "flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2 py-2 rounded-lg text-[11px] font-semibold tracking-wide transition-all",
          isActive ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
        )}
      >
        <item.icon className="w-4 h-4" />
        {item.label}
        {mobile && <ChevronRight className="w-3 h-3 ml-auto" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/" className="flex items-center gap-3 group shrink-0">
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center group-hover:bg-primary/30 transition-colors"><Zap className="w-5 h-5 text-primary" /></div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand border-2 border-background" />
              </div>
              <div><div className="text-sm font-bold text-foreground tracking-wide leading-none">ALFALUX</div><div className="text-[10px] text-muted-foreground tracking-widest leading-none mt-0.5">CADASTRO DE PRODUTOS</div></div>
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden xl:block text-right mr-1"><p className="text-xs font-medium max-w-36 truncate">{user?.name}</p><p className="text-[10px] text-muted-foreground max-w-36 truncate">{user?.email}</p></div>
              <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors" onClick={() => void logout()} aria-label="Sair"><LogOut className="w-4 h-4" /></button>
              <button className="xl:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Abrir menu">{mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
            </div>
          </div>
          <nav className="hidden xl:flex items-center gap-1 border-t border-border/50 py-2.5" aria-label="Navegação principal">
            {visibleNavItems.map((item) => renderNavItem(item))}
          </nav>
        </div>

        {mobileOpen && <div className="xl:hidden border-t border-border/60 bg-background/95 backdrop-blur-xl animate-fade-in"><div className="container py-3 flex flex-col gap-1">{visibleNavItems.map((item) => renderNavItem(item, true))}</div></div>}
      </header>

      <div className="border-b border-border/30 bg-muted/10"><div className="container"><div className="flex items-center gap-2 h-9 text-[11px] text-muted-foreground"><LayoutGrid className="w-3 h-3" /><span>ALFALUX</span><ChevronRight className="w-3 h-3" /><span className="text-foreground font-medium">{breadcrumbLabel(location)}</span></div></div></div>

      <main className="flex-1 container py-8">{children}</main>

      <footer className="border-t border-border/30 bg-muted/5"><div className="container"><div className="flex flex-col sm:flex-row items-center justify-between gap-1 min-h-12 py-3 text-[10px] sm:text-[11px] text-muted-foreground"><span>ALFALUX ILUMINAÇÃO © {new Date().getFullYear()}</span><span className="tracking-widest">CADASTRO DE PRODUTOS v1.0</span></div></div></footer>
    </div>
  );
}
