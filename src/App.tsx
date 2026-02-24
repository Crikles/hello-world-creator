import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { LojaProvider } from "@/contexts/LojaContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function LojaRoutes() {
  return (
    <LojaProvider>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="envios" element={<Envios />} />
        <Route path="postagens" element={<Postagens />} />
        <Route path="empresa" element={<Empresa />} />
        <Route path="integracoes" element={<Integracoes />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Routes>
    </LojaProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/lojas"
              element={
                <ProtectedRoute>
                  <Lojas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loja/:lojaId/*"
              element={
                <ProtectedRoute>
                  <LojaRoutes />
                </ProtectedRoute>
              }
            />
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
            <Route path="/" element={<Navigate to="/lojas" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
