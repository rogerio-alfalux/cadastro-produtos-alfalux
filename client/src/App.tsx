import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AlfaluxLayout from "./components/AlfaluxLayout";
import ProductList from "./pages/ProductList";
import ProductForm from "./pages/ProductForm";
import ComponentsPage from "./pages/Components";
import RevendaPage from "./pages/Revenda";
import AccessoriesPage from "@/pages/Accessories";
import BackupsPage from "@/pages/Backups";
import BulkReplacePage from "@/pages/BulkReplace";
import LoginPage from "@/pages/Login";
import ResetPasswordPage from "@/pages/ResetPassword";
import UsersPage from "@/pages/Users";
import { ProductCostsEditor, ProductDocumentsEditor } from "@/pages/ProductAccessEditor";
import BulkDocumentsPage from "@/pages/BulkDocuments";
import ReportsPage from "@/pages/Reports";
import { useAuth } from "@/_core/hooks/useAuth";
import { can } from "@shared/permissions";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

function CadastrarPage() {
  return <ProductForm />;
}

function Router() {
  const [location] = useLocation();
  const { user, loading } = useAuth();
  if (location === "/redefinir-senha") return <ResetPasswordPage />;
  if (loading) return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  if (!user) return <LoginPage />;
  const canUse = (permission: Parameters<typeof can>[1]) => can(user.role, permission, user.permissionOverrides);
  const canDocuments = canUse("manageDocuments");
  const canCosts = canUse("editCosts");
  const canViewCatalog = canUse("viewCatalog");
  const canManageUsers = canUse("manageUsers");
  const canManageEntities = canUse("manageEntities");
  const canViewReports = canUse("viewReports");

  return (
    <AlfaluxLayout>
      <Switch>
        <Route path="/" component={ProductList} />
        <Route path="/login" component={ProductList} />
        <Route path="/documentos/:id">{canDocuments ? <ProductDocumentsEditor /> : <NotFound />}</Route>
        <Route path="/custos/:id">{canCosts ? <ProductCostsEditor /> : <NotFound />}</Route>
        <Route path="/usuarios">{canManageUsers ? <UsersPage /> : <NotFound />}</Route>
        <Route path="/relatorios">{canViewReports ? <ReportsPage /> : <NotFound />}</Route>
        <Route path="/documentos-em-massa">{canDocuments ? <BulkDocumentsPage /> : <NotFound />}</Route>
        <Route path="/cadastrar">{canManageEntities ? <CadastrarPage /> : <NotFound />}</Route>
        <Route path="/componentes">{canViewCatalog ? <ComponentsPage /> : <NotFound />}</Route>
        <Route path="/revenda">{canViewCatalog ? <RevendaPage /> : <NotFound />}</Route>
        <Route path="/acessorios">{canViewCatalog ? <AccessoriesPage /> : <NotFound />}</Route>
        <Route path="/backups">{canManageUsers ? <BackupsPage /> : <NotFound />}</Route>
        <Route path="/substituicao-em-massa">{canManageEntities ? <BulkReplacePage /> : <NotFound />}</Route>
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AlfaluxLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
