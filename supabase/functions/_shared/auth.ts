// Shared auth helpers for edge functions.
// Goal: every callable function must authenticate the caller as one of:
//  - service-role (raw key or signed JWT)
//  - the loja owner / target user
//  - an admin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthContext {
  isServiceRole: boolean;
  userId: string | null;
  isAdmin: boolean;
}

export async function getAuthContext(req: Request): Promise<AuthContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  let isServiceRole = !!token && token === serviceRoleKey;
  if (!isServiceRole && token) {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload?.role === "service_role") isServiceRole = true;
      }
    } catch { /* ignore */ }
  }

  if (isServiceRole) {
    return { isServiceRole: true, userId: null, isAdmin: false };
  }

  if (!token || token === anonKey) {
    return { isServiceRole: false, userId: null, isAdmin: false };
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isServiceRole: false, userId: null, isAdmin: false };

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleRow } = await admin
    .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();

  return { isServiceRole: false, userId: user.id, isAdmin: !!roleRow };
}

export function unauthorized(message = "Não autorizado") {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}

export function forbidden(message = "Acesso negado") {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}

// Returns true if the given user owns the given loja
export async function userOwnsLoja(userId: string, lojaId: string): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await supabase.from("lojas").select("id").eq("id", lojaId).eq("user_id", userId).maybeSingle();
  return !!data;
}
