import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface Loja {
  id: string;
  user_id: string;
  nome: string;
  slug: string;
  webhook_token: string;
  created_at: string;
  updated_at: string;
  logistica_provider: string | null;
}

interface LojaContextType {
  loja: Loja | null;
  loading: boolean;
}

const LojaContext = createContext<LojaContextType>({ loja: null, loading: true });

export function LojaProvider({ children }: { children: ReactNode }) {
  const { lojaId } = useParams<{ lojaId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lojaId || !user) {
      setLoading(false);
      return;
    }

    const fetchLoja = async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("*")
        .eq("id", lojaId)
        .maybeSingle();

      if (error || !data) {
        navigate("/lojas");
        return;
      }
      setLoja(data as Loja);
      setLoading(false);
    };

    fetchLoja();
  }, [lojaId, user, navigate]);

  return (
    <LojaContext.Provider value={{ loja, loading }}>
      {children}
    </LojaContext.Provider>
  );
}

export const useLoja = () => useContext(LojaContext);
