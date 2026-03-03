import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginAs: (targetUser: any) => void;
  exitImpersonation: () => void;
  isImpersonating: boolean;
  realUser: User | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => { },
  loginAs: () => { },
  exitImpersonation: () => { },
  isImpersonating: false,
  realUser: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUser, setImpersonatedUser] = useState<any | null>(() => {
    const saved = sessionStorage.getItem("impersonated_user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("blocked")
          .eq("id", session.user.id)
          .maybeSingle();
        if (profile?.blocked) {
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
    sessionStorage.removeItem("impersonated_user");
    await supabase.auth.signOut();
  };

  const loginAs = (targetUser: any) => {
    // We construct a fake user object that looks like Supabase User
    const fakeUser = {
      id: targetUser.id,
      email: targetUser.email,
      user_metadata: {
        full_name: targetUser.full_name
      },
      is_impersonated: true
    };
    setImpersonatedUser(fakeUser);
    sessionStorage.setItem("impersonated_user", JSON.stringify(fakeUser));
  };

  const exitImpersonation = () => {
    setImpersonatedUser(null);
    sessionStorage.removeItem("impersonated_user");
  };

  return (
    <AuthContext.Provider value={{
      user: impersonatedUser ?? user,
      session,
      loading,
      signOut,
      loginAs,
      exitImpersonation,
      isImpersonating: !!impersonatedUser,
      realUser: user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
