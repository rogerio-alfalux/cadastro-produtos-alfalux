import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  PlusCircle,
  Database,
  ChevronRight,
  Zap,
  Menu,
  X,
  Cpu,
  Layers,
  ShoppingCart,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "PRODUTOS", href: "/", icon: Database },
  { label: "CADASTRAR", href: "/cadastrar", icon: PlusCircle },
  { label: "REVENDA", href: "/revenda", icon: ShoppingCart },
  { label: "COMPONENTES", href: "/componentes", icon: Cpu },
  { label: "EM MASSA", href: "/operacoes-em-massa", icon: Layers },
];

interface AlfaluxLayoutProps {
  children: React.ReactNode;
}

export default function AlfaluxLayout({ children }: AlfaluxLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand border-2 border-background" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground tracking-wide leading-none">
                  ALFALUX
                </div>
                <div className="text-[10px] text-muted-foreground tracking-widest leading-none mt-0.5">
                  CADASTRO DE PRODUTOS
                </div>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all",
                      isActive
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-xl animate-fade-in">
            <div className="container py-3 flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wider transition-all",
                      isActive
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* ─── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="border-b border-border/30 bg-muted/10">
        <div className="container">
          <div className="flex items-center gap-2 h-9 text-[11px] text-muted-foreground">
            <LayoutGrid className="w-3 h-3" />
            <span>ALFALUX</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">
              {location === "/" ? "PRODUTOS" : location === "/cadastrar" ? "CADASTRAR PRODUTO" : location.startsWith("/revenda") ? "REVENDA" : location.startsWith("/componentes") ? "COMPONENTES" : location.startsWith("/operacoes-em-massa") ? "OPERAÇÕES EM MASSA" : "EDITAR PRODUTO"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <main className="flex-1 container py-8">
        {children}
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/30 bg-muted/5">
        <div className="container">
          <div className="flex items-center justify-between h-12 text-[11px] text-muted-foreground">
            <span>ALFALUX ILUMINAÇÃO © {new Date().getFullYear()}</span>
            <span className="tracking-widest">CADASTRO DE PRODUTOS v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
