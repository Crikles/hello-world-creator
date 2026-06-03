// JL e Vetor foram descontinuados — todos os links curtos passam a apontar para Atlas.
const BASE_URL = "https://atlas-cargo.org";

Deno.serve((req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("c");
  const paymentId = url.searchParams.get("p");
  const falhaId = url.searchParams.get("f");

  if (!code && !paymentId && !falhaId) {
    return new Response("Missing parameter", { status: 400 });
  }

  let destination: string;
  if (code) {
    destination = `${BASE_URL}/r/${code}`;
  } else if (falhaId) {
    destination = `${BASE_URL}/f/${falhaId}`;
  } else {
    destination = `${BASE_URL}/p/${paymentId}`;
  }

  return new Response(null, {
    status: 302,
    headers: { Location: destination },
  });
});
