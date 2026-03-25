import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: "phone e code são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the most recent pending verification for this phone
    const { data: verification, error: fetchErr } = await supabase
      .from("signup_verifications")
      .select("*")
      .eq("phone", phone)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error("Fetch error:", fetchErr);
      throw new Error("Erro ao buscar verificação");
    }

    if (!verification) {
      return new Response(
        JSON.stringify({ error: "Nenhuma verificação pendente encontrada para este número." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(verification.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from("signup_verifications")
        .update({ status: "expirado" })
        .eq("id", verification.id);

      return new Response(
        JSON.stringify({ error: "Código expirado. Solicite um novo." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check code
    if (verification.code !== code.trim()) {
      return new Response(
        JSON.stringify({ error: "Código incorreto." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as verified
    const { error: updateErr } = await supabase
      .from("signup_verifications")
      .update({ status: "verificado", verified_at: new Date().toISOString() })
      .eq("id", verification.id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      throw new Error("Erro ao atualizar verificação");
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
