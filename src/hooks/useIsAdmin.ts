import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { realUser } = useAuth();

  const { data: isAdmin = false, isLoading: loading } = useQuery({
    queryKey: ["is-admin", realUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", realUser!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!realUser,
  });

  return { isAdmin, loading };
}
