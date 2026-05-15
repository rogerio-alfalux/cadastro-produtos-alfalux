import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AlfaluxLayout from "./components/AlfaluxLayout";
import ProductList from "./pages/ProductList";
import ProductForm from "./pages/ProductForm";

function CadastrarPage() {
  return <ProductForm />;
}

function Router() {
  return (
    <AlfaluxLayout>
      <Switch>
        <Route path="/" component={ProductList} />
        <Route path="/cadastrar" component={CadastrarPage} />
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
