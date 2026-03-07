import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { LojaProvider } from "@/contexts/LojaContext";
import { isLogisticsDomain } from "@/lib/domain-config";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Lojas from "./pages/Lojas";
import Dashboard from "./pages/Dashboard";
import Envios from "./pages/Envios";
import Empresa from "./pages/Empresa";
import Integracoes from "./pages/Integracoes";
import Configuracoes from "./pages/Configuracoes";
import Postagens from "./pages/Postagens";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsuarios from "./pages/admin/AdminUsuarios";
import AdminCreditos from "./pages/admin/AdminCreditos";
import AdminEmail from "./pages/admin/AdminEmail";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminValores from "./pages/admin/AdminValores";
import AdminSMS from "./pages/admin/AdminSMS";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminPush from "./pages/admin/AdminPush";
import AdminPagamentos from "./pages/admin/AdminPagamentos";
import AdminSuporte from "./pages/admin/AdminSuporte";
import NotFound from "./pages/NotFound";
import Pagamento from "./pages/Pagamento";
import PagamentoFalha from "./pages/PagamentoFalha";
import Rastreio from "./pages/Rastreio";
import Taxacao from "./pages/Taxacao";
import FalhaEntrega from "./pages/FalhaEntrega";
import Moedas from "./pages/Moedas";
import Indicacao from "./pages/Indicacao";
import ResetPassword from "./pages/ResetPassword";
import Suporte from "./pages/Suporte";

const queryClient = new QueryClient();

function LojaLayoutWrapper() {
  return (
    <LojaProvider>
      <AppLayout />
    </LojaProvider>
  );
}

function LogisticsRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Rastreio />} />
      <Route path="/p/:envioId" element={<Pagamento />} />
      <Route path="/f/:envioId" element={<PagamentoFalha />} />
      <Route path="/r" element={<Rastreio />} />
      <Route path="/r/:codigoParam" element={<Rastreio />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PanelRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/lojas"
          element={
            <ProtectedRoute>
              <Lojas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loja/:lojaId"
          element={
            <ProtectedRoute>
              <LojaLayoutWrapper />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="envios" element={<Envios />} />
          <Route path="postagens" element={<Postagens />} />
          <Route path="empresa" element={<Empresa />} />
          <Route path="integracoes" element={<Integracoes />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="taxacao" element={<Taxacao />} />
          <Route path="falha-entrega" element={<FalhaEntrega />} />
          <Route path="moedas" element={<Moedas />} />
          <Route path="indicacao" element={<Indicacao />} />
          <Route path="suporte" element={<Suporte />} />
        </Route>
        <Route
          path="/admin"
          element={<AdminRoute><AdminDashboard /></AdminRoute>}
        />
        <Route
          path="/admin/usuarios"
          element={<AdminRoute><AdminUsuarios /></AdminRoute>}
        />
        <Route
          path="/admin/email"
          element={<AdminRoute><AdminEmail /></AdminRoute>}
        />
        <Route
          path="/admin/creditos"
          element={<AdminRoute><AdminCreditos /></AdminRoute>}
        />
        <Route
          path="/admin/templates"
          element={<AdminRoute><AdminTemplates /></AdminRoute>}
        />
        <Route
          path="/admin/valores"
          element={<AdminRoute><AdminValores /></AdminRoute>}
        />
        <Route
          path="/admin/sms"
          element={<AdminRoute><AdminSMS /></AdminRoute>}
        />
        <Route
          path="/admin/leads"
          element={<AdminRoute><AdminLeads /></AdminRoute>}
        />
        <Route
          path="/admin/push"
          element={<AdminRoute><AdminPush /></AdminRoute>}
        />
        <Route
          path="/admin/pagamentos"
          element={<AdminRoute><AdminPagamentos /></AdminRoute>}
        />
        <Route
          path="/admin/suporte"
          element={<AdminRoute><AdminSuporte /></AdminRoute>}
        />
        <Route path="/r" element={<Rastreio />} />
        <Route path="/r/:codigoParam" element={<Rastreio />} />
        <Route path="/p/:envioId" element={<Pagamento />} />
        <Route path="/" element={<Navigate to="/lojas" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

const App = () => {
  const logistics = isLogisticsDomain();

  if (typeof document !== 'undefined') {
    document.title = logistics ? 'Logística JL Transportes' : 'Magnus Frete';
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {logistics ? <LogisticsRoutes /> : <PanelRoutes />}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
