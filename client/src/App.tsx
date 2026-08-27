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
import UsersPage from "@/pages/Users";
import { ProductCostsEditor, ProductDocumentsEditor } from "@/pages/ProductAccessEditor";
import BulkDocumentsPage from "@/pages/BulkDocuments";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

function CadastrarPage() {
  return <ProductForm />;
}

function Router() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  if (!user) return <LoginPage />;
  const isAdmin = user.role === "admin";
  const canDocuments = isAdmin || user.role === "engineering";
  const canCosts = isAdmin || user.role === "costs";

  return (
    <AlfaluxLayout>
      <Switch>
        <Route path="/" component={ProductList} />
        <Route path="/login" component={ProductList} />
        <Route path="/documentos/:id">{canDocuments ? <ProductDocumentsEditor /> : <NotFound />}</Route>
        <Route path="/custos/:id">{canCosts ? <ProductCostsEditor /> : <NotFound />}</Route>
        <Route path="/usuarios">{isAdmin ? <UsersPage /> : <NotFound />}</Route>
        <Route path="/documentos-em-massa">{isAdmin ? <BulkDocumentsPage /> : <NotFound />}</Route>
        <Route path="/cadastrar">{isAdmin ? <CadastrarPage /> : <NotFound />}</Route>
        <Route path="/componentes">{isAdmin ? <ComponentsPage /> : <NotFound />}</Route>
        <Route path="/revenda">{isAdmin ? <RevendaPage /> : <NotFound />}</Route>
        <Route path="/acessorios">{isAdmin ? <AccessoriesPage /> : <NotFound />}</Route>
        <Route path="/backups">{isAdmin ? <BackupsPage /> : <NotFound />}</Route>
        <Route path="/substituicao-em-massa">{isAdmin ? <BulkReplacePage /> : <NotFound />}</Route>
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
