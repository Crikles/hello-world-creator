import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  return String(phone ?? "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();
    const normalizedPhone = normalizePhone(phone);
    const trimmedCode = String(code ?? "").trim();

    if (!normalizedPhone || !trimmedCode) {
      return new Response(
        JSON.stringify({ error: "phone e code são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // First try exact normalized phone match (new records)
    const { data: exactVerification, error: exactErr } = await supabase
      .from("signup_verifications")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (exactErr) {
      console.error("Fetch error (exact):", exactErr);
      throw new Error("Erro ao buscar verificação");
    }

    let verification = exactVerification;

    // Fallback for legacy records with formatted phones (spaces, symbols)
    if (!verification) {
      const { data: codeCandidates, error: codeErr } = await supabase
        .from("signup_verifications")
        .select("*")
        .eq("status", "pendente")
        .eq("code", trimmedCode)
        .order("created_at", { ascending: false })
        .limit(30);

      if (codeErr) {
        console.error("Fetch error (fallback):", codeErr);
        throw new Error("Erro ao buscar verificação");
      }

      verification = (codeCandidates || []).find(
        (row: any) => normalizePhone(row.phone) === normalizedPhone
      );
    }

    if (!verification) {
      return new Response(
        JSON.stringify({ error: "Nenhuma verificação pendente encontrada para este número." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(verification.expires_at) < new Date()) {
      await supabase
        .from("signup_verifications")
        .update({ status: "expirado" })
        .eq("id", verification.id);

      return new Response(
        JSON.stringify({ error: "Código expirado. Solicite um novo." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (verification.code !== trimmedCode) {
      return new Response(
        JSON.stringify({ error: "Código incorreto." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateErr } = await supabase
      .from("signup_verifications")
      .update({ status: "verificado", verified_at: new Date().toISOString() })
      .eq("id", verification.id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      throw new Error("Erro ao atualizar verificação");
    }

    // Mark the user's profile as whatsapp_verified
    // Find profile by normalized phone
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ whatsapp_verified: true })
      .eq("whatsapp", normalizedPhone);

    if (profileErr) {
      console.error("Profile update error (non-blocking):", profileErr);
    }

    return new Response(
      JSON.stringify({ verified: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in verify-sms-code:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});