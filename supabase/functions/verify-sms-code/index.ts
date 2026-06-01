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
    const { phone, code, check_only } = await req.json();
    const normalizedPhone = normalizePhone(phone);
    const trimmedCode = String(code ?? "").trim();
    const checkOnly = check_only === true;

    if (!normalizedPhone) {
      return new Response(
        JSON.stringify({ error: "phone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!checkOnly && !trimmedCode) {
      return new Response(
        JSON.stringify({ error: "code é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (checkOnly) {
      // Fetch the MOST RECENT record for this phone (any status)
      const { data: latestRecord, error: checkErr } = await supabase
        .from("signup_verifications")
        .select("id, status, phone")
        .eq("phone", normalizedPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkErr) {
        console.error("Check error:", checkErr);
        throw new Error("Erro ao verificar status");
      }

      // Only return verified if the LATEST record is verified
      const verified = latestRecord?.status === "verificado";

      return new Response(
        JSON.stringify({ verified }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Rate limit: count recent failed attempts for this phone (max 5 in 10 min)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: failedAttempts } = await supabase
      .from("signup_verifications")
      .select("*", { count: "exact", head: true })
      .eq("phone", normalizedPhone)
      .eq("status", "bloqueado")
      .gte("created_at", tenMinAgo);

    if ((failedAttempts || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas incorretas. Aguarde 10 minutos e solicite um novo código." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (verification.code !== trimmedCode) {
      // Mark this verification as blocked after wrong attempt
      // We track by updating the current record to count attempts
      const attempts = (verification as any).attempts || 0;
      if (attempts >= 4) {
        // 5th wrong attempt — invalidate the code
        await supabase
          .from("signup_verifications")
          .update({ status: "bloqueado" })
          .eq("id", verification.id);
        return new Response(
          JSON.stringify({ error: "Código bloqueado por muitas tentativas incorretas. Solicite um novo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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