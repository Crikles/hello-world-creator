/*!
 * Atlas Cargo — Widget de Rastreio embutível
 * Uso:
 *   <div class="atlas-order-tracking" data-loja="LOJA_UUID"></div>
 *   <script src="https://atlas-cargo.org/widget/tracking.js" async></script>
 *
 * Opcional:
 *   data-cor="#0066ff"     -> sobrescreve a cor primária
 *   data-api="https://..."  -> sobrescreve o host da API (debug)
 */
(function () {
  "use strict";

  var DEFAULT_API = "https://wzxfbejykayahnfdkdbl.supabase.co/functions/v1";
  var DEFAULT_TRACK_URL = "https://atlas-cargo.org/r/";
  var ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6eGZiZWp5a2F5YWhuZmRrZGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyOTcxMTEsImV4cCI6MjA5NTg3MzExMX0.oIkx0CT7cZ5uoP_bSf9VFa4kre9b9--ng5KcdyVxNEY";

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "class") el.className = attrs[k];
        else if (k === "html") el.innerHTML = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function")
          el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else el.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return el;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) +
        " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (_) { return ""; }
  }

  function css(primary) {
    return [
      ":host{all:initial;}",
      "*,*::before,*::after{box-sizing:border-box;}",
      ".w{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:980px;margin:0 auto;padding:24px 16px;}",
      ".grid{display:grid;grid-template-columns:1fr auto 1fr;gap:24px;align-items:stretch;}",
      "@media(max-width:720px){.grid{grid-template-columns:1fr;}.sep{display:none;}}",
      ".card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px;}",
      ".sep{display:flex;align-items:center;justify-content:center;color:#94a3b8;font-weight:600;}",
      ".label{font-size:13px;color:#334155;font-weight:500;}",
      ".input{width:100%;padding:11px 13px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;color:#0f172a;background:#fff;outline:none;}",
      ".input:focus{border-color:" + primary + ";box-shadow:0 0 0 3px " + primary + "22;}",
      ".btn{background:" + primary + ";color:#fff;border:0;border-radius:8px;padding:11px 16px;font:inherit;font-weight:600;cursor:pointer;transition:filter .15s;}",
      ".btn:hover{filter:brightness(.92);}",
      ".btn:disabled{opacity:.6;cursor:not-allowed;}",
      ".btn-ghost{background:transparent;color:" + primary + ";border:1px solid " + primary + ";}",
      ".err{color:#b91c1c;font-size:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;}",
      ".title{font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;}",
      ".sub{font-size:14px;color:#64748b;text-align:center;margin:0 0 24px;}",
      ".result{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;}",
      ".result-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;border-bottom:1px solid #f1f5f9;padding-bottom:14px;margin-bottom:14px;}",
      ".chip{display:inline-block;background:" + primary + "15;color:" + primary + ";padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;}",
      ".timeline{position:relative;padding-left:24px;}",
      ".timeline::before{content:'';position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:#e2e8f0;}",
      ".ev{position:relative;padding:10px 0 14px;}",
      ".ev::before{content:'';position:absolute;left:-21px;top:14px;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid " + primary + ";}",
      ".ev.done::before{background:" + primary + ";}",
      ".ev-title{font-weight:600;font-size:15px;}",
      ".ev-desc{font-size:13px;color:#475569;margin-top:2px;}",
      ".ev-date{font-size:12px;color:#94a3b8;margin-top:4px;}",
      ".muted{color:#64748b;font-size:13px;}",
      ".row{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#334155;}",
      ".row b{color:#0f172a;font-weight:600;}",
      ".back{margin-top:14px;font-size:13px;color:" + primary + ";background:transparent;border:0;cursor:pointer;padding:0;text-decoration:underline;}",
      ".loading{text-align:center;padding:32px;color:#64748b;font-size:14px;}",
    ].join("");
  }

  function mount(host) {
    var lojaId = host.getAttribute("data-loja") || host.getAttribute("data-loja-id");
    if (!lojaId) {
      host.innerHTML = '<div style="color:#b91c1c;font-family:sans-serif;font-size:14px;padding:12px;">Widget de Rastreio: atributo data-loja é obrigatório.</div>';
      return;
    }
    if (host.__atlasMounted) return;
    host.__atlasMounted = true;

    var API = host.getAttribute("data-api") || DEFAULT_API;
    var primary = host.getAttribute("data-cor") || "#1d4ed8";

    var shadow = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var style = document.createElement("style");
    style.textContent = css(primary);
    shadow.appendChild(style);

    var root = h("div", { class: "w" });
    shadow.appendChild(root);

    function render(view) { root.innerHTML = ""; root.appendChild(view); }
    function showError(parent, msg) {
      var existing = parent.querySelector(".err");
      if (existing) existing.remove();
      parent.appendChild(h("div", { class: "err" }, msg));
    }

    function api(path, params) {
      var qs = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
      }).join("&");
      return fetch(API + path + "?" + qs, {
        headers: { "apikey": ANON_KEY, "Authorization": "Bearer " + ANON_KEY },
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, status: r.status, data: j }; });
      });
    }

    function viewForm() {
      var wrap = h("div", null);
      wrap.appendChild(h("h2", { class: "title" }, "Rastreio"));
      wrap.appendChild(h("p", { class: "sub" }, "Acompanhe seu pedido em tempo real"));

      var grid = h("div", { class: "grid" });

      // Left card: pedido + email
      var leftErr = null;
      var inpNum = h("input", { class: "input", placeholder: "Número do Pedido", autocomplete: "off" });
      var inpMail = h("input", { class: "input", type: "email", placeholder: "E-mail", autocomplete: "email" });
      var btnLeft = h("button", { class: "btn" }, "Localizar");
      var leftCard = h("div", { class: "card" }, [
        h("label", { class: "label" }, "Número do Pedido"),
        inpNum,
        h("label", { class: "label" }, "E-mail"),
        inpMail,
        btnLeft,
      ]);

      btnLeft.addEventListener("click", function () {
        var num = (inpNum.value || "").trim();
        var mail = (inpMail.value || "").trim();
        if (!num || !mail) { showError(leftCard, "Preencha pedido e e-mail."); return; }
        btnLeft.disabled = true; btnLeft.textContent = "Buscando...";
        api("/widget-buscar-pedido", { loja_id: lojaId, numero: num, email: mail })
          .then(function (res) {
            btnLeft.disabled = false; btnLeft.textContent = "Localizar";
            if (!res.ok) { showError(leftCard, res.data.error || "Pedido não encontrado."); return; }
            loadTracking(res.data.codigo_rastreio);
          })
          .catch(function () {
            btnLeft.disabled = false; btnLeft.textContent = "Localizar";
            showError(leftCard, "Falha de conexão. Tente novamente.");
          });
      });

      // Right card: codigo de rastreio
      var inpCod = h("input", { class: "input", placeholder: "Número de Rastreio", autocomplete: "off" });
      var btnRight = h("button", { class: "btn" }, "Localizar");
      var rightCard = h("div", { class: "card" }, [
        h("label", { class: "label" }, "Número de Rastreio"),
        inpCod,
        btnRight,
      ]);

      btnRight.addEventListener("click", function () {
        var cod = (inpCod.value || "").trim().toUpperCase();
        if (!cod) { showError(rightCard, "Informe o código de rastreio."); return; }
        loadTracking(cod);
      });

      [inpNum, inpMail].forEach(function (el) {
        el.addEventListener("keydown", function (e) { if (e.key === "Enter") btnLeft.click(); });
      });
      inpCod.addEventListener("keydown", function (e) { if (e.key === "Enter") btnRight.click(); });

      grid.appendChild(leftCard);
      grid.appendChild(h("div", { class: "sep" }, "Ou"));
      grid.appendChild(rightCard);
      wrap.appendChild(grid);
      render(wrap);
    }

    function loadTracking(codigo) {
      var loading = h("div", { class: "loading" }, "Carregando rastreio...");
      render(loading);
      api("/rastreio-info", { codigo: codigo, loja_id: lojaId })
        .then(function (res) {
          if (!res.ok) {
            var v = h("div", null);
            v.appendChild(h("h2", { class: "title" }, "Rastreio"));
            v.appendChild(h("div", { class: "err" }, res.data.error || "Código não encontrado."));
            var back = h("button", { class: "back" }, "← Voltar");
            back.addEventListener("click", viewForm);
            v.appendChild(back);
            render(v);
            return;
          }
          renderResult(res.data, codigo);
        })
        .catch(function () {
          var v = h("div", null);
          v.appendChild(h("div", { class: "err" }, "Falha de conexão."));
          var back = h("button", { class: "back" }, "← Voltar");
          back.addEventListener("click", viewForm);
          v.appendChild(back);
          render(v);
        });
    }

    function renderResult(data, codigo) {
      var envio = data.envio || {};
      var eventos = (data.eventos || []).slice().reverse();
      var wrap = h("div", null);

      var head = h("div", { class: "result-head" }, [
        h("div", null, [
          h("div", { class: "chip" }, envio.status || "Em andamento"),
          h("div", { style: "font-size:18px;font-weight:700;margin-top:8px;" }, envio.produto || "Pedido"),
          h("div", { class: "muted" }, "Código: " + (envio.codigo_rastreio || codigo)),
        ]),
        h("div", { style: "text-align:right;" }, [
          h("div", { class: "muted" }, "Transportadora"),
          h("div", { style: "font-weight:600;" }, envio.transportadora || "—"),
        ]),
      ]);

      var info = h("div", { class: "row", style: "margin-bottom:14px;" }, [
        h("div", null, [h("b", null, "Destinatário: "), document.createTextNode(envio.cliente_nome || "—")]),
        h("div", null, [h("b", null, "Destino: "), document.createTextNode((envio.cliente_cidade || "—") + (envio.cliente_estado ? "/" + envio.cliente_estado : ""))]),
      ]);

      var tl = h("div", { class: "timeline" });
      if (!eventos.length) {
        tl.appendChild(h("div", { class: "muted" }, "Nenhuma atualização ainda. Volte em breve."));
      } else {
        eventos.forEach(function (ev, i) {
          var node = h("div", { class: "ev" + (i === 0 ? " done" : " done") });
          node.appendChild(h("div", { class: "ev-title" }, ev.nome || ev.status_label || ""));
          if (ev.descricao) node.appendChild(h("div", { class: "ev-desc" }, ev.descricao));
          tl.appendChild(node);
        });
      }

      var back = h("button", { class: "back" }, "← Nova consulta");
      back.addEventListener("click", viewForm);

      var card = h("div", { class: "result" }, [head, info, tl, back]);
      wrap.appendChild(card);
      render(wrap);
    }

    viewForm();
  }

  function init() {
    var nodes = document.querySelectorAll(".atlas-order-tracking, [data-atlas-tracking]");
    nodes.forEach(mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Re-mount when new nodes are added dynamically
  if (window.MutationObserver) {
    var mo = new MutationObserver(function () { init(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
