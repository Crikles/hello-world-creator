import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("c");
  const paymentId = url.searchParams.get("p");

  if (!code && !paymentId) {
    return new Response("Missing parameter", { status: 400 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the current tracking base URL from system_config
    const { data: config } = await supabase
      .from("system_config")
      .select("label")
      .eq("key", "tracking_base_url")
      .single();

    // We store the actual URL in the `label` field since `value` is numeric
    const baseUrl = config?.label || "https://rastreio.jltransportelogistica.com";

    let destination: string;
    if (code) {
      destination = `${baseUrl}/r/${code}`;
    } else {
      destination = `${baseUrl}/p/${paymentId}`;
    }

    return new Response(null, {
      status: 302,
      headers: { Location: destination },
    });
  } catch (error) {
    console.error("Redirect error:", error);
    // Fallback to hardcoded domain
    const fallback = "https://rastreio.jltransportelogistica.com";
    const dest = code ? `${fallback}/r/${code}` : `${fallback}/p/${paymentId}`;
    return new Response(null, {
      status: 302,
      headers: { Location: dest },
    });
  }
});
