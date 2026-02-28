import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCheckingBlocked = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isCheckingBlocked) return;

      if (event === "SIGNED_IN" && session?.user) {
        isCheckingBlocked = true;
        const { data: profile } = await supabase
          .from("profiles")
          .select("blocked")
          .eq("id", session.user.id)
          .single();
        isCheckingBlocked = false;

        if ((profile as any)?.blocked) {
          setSession(null);
          setUser(null);
          setLoading(false);
          await supabase.auth.signOut();
          return;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("blocked")
          .eq("id", session.user.id)
          .single();
        if ((profile as any)?.blocked) {
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
