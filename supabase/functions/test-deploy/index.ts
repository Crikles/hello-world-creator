Deno.serve(async (req) => {
  const payload = await req.json();
  return new Response(JSON.stringify({ ok: true, got: payload.event }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
