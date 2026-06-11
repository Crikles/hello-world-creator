/*!
 * Atlas Cargo — Widget de Rastreio embutível
 * Uso:
 *   <div class="atlas-order-tracking" data-loja="LOJA_UUID"></div>
 *   <script src="https://atlas-cargo.org/widget/tracking.js" async></script>
 *
 * Opcional:
 *   data-cor="#0066ff"     -> sobrescreve a cor primária (senão usa a da loja)
 *   data-api="https://..."  -> sobrescreve o host da API (debug)
 */
(function () {
  "use strict";

  var DEFAULT_API = "https://wzxfbejykayahnfdkdbl.supabase.co/functions/v1";
  var ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6eGZiZWp5a2F5YWhuZmRrZGJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyOTcxMTEsImV4cCI6MjA5NTg3MzExMX0.oIkx0CT7cZ5uoP_bSf9VFa4kre9b9--ng5KcdyVxNEY";

  var STATUS_LABELS = {
    pendente: "Pendente",
    postado: "Postado",
    coletado: "Coletado",
    em_transito: "Em trânsito",
    saiu_para_entrega: "Saiu para entrega",
    entregue: "Entregue",
    taxacao: "Aguardando taxação",
    pago: "Taxa paga",
    falha_entrega: "Falha na entrega",
    devolvido: "Devolvido",
  };

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

  function decodeEntities(s) {
    if (!s) return "";
    return String(s)
      .replace(/&quot;/g, '"').replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#39;|&apos;|&#x27;/g, "'")
      .replace(/&#(\d+);/g, function (_, c) { return String.fromCharCode(Number(c)); });
  }

  function formatProduto(raw) {
    if (!raw) return "Pedido";
    try {
      var items = JSON.parse(raw);
      if (Array.isArray(items) && items.length) {
        return items.map(function (i) {
          var name = decodeEntities(i.name || i.nome || i.title || "Produto");
          var qty = i.quantity || i.quantidade || 1;
          return qty > 1 ? name + " (x" + qty + ")" : name;
        }).join(", ");
      }
    } catch (_) {}
    return decodeEntities(raw);
  }

  function statusLabel(s) {
    if (!s) return "Em andamento";
    return STATUS_LABELS[s] || s.replace(/_/g, " ").replace(/^\w/, function (c) { return c.toUpperCase(); });
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    } catch (_) { return ""; }
  }

  function fmtDateLong(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    } catch (_) { return "—"; }
  }

  function css(p) {
    return [
      ":host{all:initial;}",
      "*,*::before,*::after{box-sizing:border-box;}",
      ".w{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:980px;margin:0 auto;padding:24px 16px;}",
      ".grid{display:grid;grid-template-columns:1fr auto 1fr;gap:24px;align-items:stretch;}",
      "@media(max-width:720px){.grid{grid-template-columns:1fr;}.sep{display:none;}.route{grid-template-columns:1fr!important;text-align:left!important;}.route .arrow{display:none;}}",
      ".card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:12px;box-shadow:0 1px 2px rgba(15,23,42,.04);}",
      ".sep{display:flex;align-items:center;justify-content:center;color:#94a3b8;font-weight:600;}",
      ".label{font-size:13px;color:#334155;font-weight:500;}",
      ".hint{font-size:11px;color:#94a3b8;font-weight:400;margin-left:4px;}",
      ".input{width:100%;padding:11px 13px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;color:#0f172a;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s;}",
      ".input:focus{border-color:" + p + ";box-shadow:0 0 0 3px " + p + "22;}",
      ".btn{background:" + p + ";color:#fff;border:0;border-radius:8px;padding:12px 16px;font:inherit;font-weight:600;cursor:pointer;transition:filter .15s;}",
      ".btn:hover{filter:brightness(.92);}",
      ".btn:disabled{opacity:.6;cursor:not-allowed;}",
      ".btn-ghost{background:transparent;color:" + p + ";border:1px solid " + p + ";border-radius:8px;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer;}",
      ".err{color:#b91c1c;font-size:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;}",
      ".title{font-size:24px;font-weight:700;margin:0 0 6px;text-align:center;letter-spacing:-.02em;}",
      ".sub{font-size:14px;color:#64748b;text-align:center;margin:0 0 24px;}",
      ".result{display:flex;flex-direction:column;gap:16px;}",
      ".rcard{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:22px;box-shadow:0 1px 2px rgba(15,23,42,.04);}",
      ".rhead{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;}",
      ".rhead-l{flex:1;min-width:240px;}",
      ".chip{display:inline-flex;align-items:center;gap:6px;background:" + p + "15;color:" + p + ";padding:5px 12px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.02em;}",
      ".chip::before{content:'';width:6px;height:6px;border-radius:50%;background:" + p + ";box-shadow:0 0 0 3px " + p + "33;}",
      ".prod{font-size:19px;font-weight:700;margin:10px 0 4px;letter-spacing:-.01em;line-height:1.3;}",
      ".codeline{display:flex;align-items:center;gap:8px;font-size:13px;color:#64748b;flex-wrap:wrap;}",
      ".code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a;background:#f1f5f9;padding:3px 8px;border-radius:6px;font-size:12px;letter-spacing:.04em;}",
      ".cpy{background:transparent;border:0;color:" + p + ";cursor:pointer;font:inherit;font-size:12px;font-weight:600;padding:2px 4px;}",
      ".carrier{display:flex;align-items:center;gap:8px;text-align:right;}",
      ".carrier .ico{width:36px;height:36px;border-radius:8px;background:" + p + "15;display:flex;align-items:center;justify-content:center;color:" + p + ";}",
      ".carrier-name{font-weight:600;font-size:14px;color:#0f172a;}",
      ".carrier-sub{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;}",
      ".route{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;padding:16px;background:#f8fafc;border-radius:12px;}",
      ".route .stop{display:flex;flex-direction:column;gap:2px;}",
      ".route .stop.r{text-align:right;}",
      ".route .stop-label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;font-weight:600;}",
      ".route .stop-city{font-size:15px;font-weight:700;color:#0f172a;}",
      ".route .arrow{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:80px;}",
      ".route .bar{position:relative;height:3px;width:100%;background:#e2e8f0;border-radius:2px;overflow:hidden;}",
      ".route .bar > i{position:absolute;left:0;top:0;bottom:0;background:" + p + ";border-radius:2px;}",
      ".route .arrow-ico{color:" + p + ";font-size:14px;font-weight:700;}",
      ".dest-row{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:13px;color:#475569;padding-top:14px;border-top:1px solid #f1f5f9;}",
      ".dest-row b{color:#0f172a;font-weight:600;}",
      ".tl-title{font-size:13px;font-weight:600;color:#334155;text-transform:uppercase;letter-spacing:.08em;margin:0 0 14px;}",
      ".timeline{position:relative;padding-left:26px;}",
      ".timeline::before{content:'';position:absolute;left:8px;top:8px;bottom:8px;width:2px;background:#e2e8f0;}",
      ".ev{position:relative;padding:4px 0 18px;}",
      ".ev:last-child{padding-bottom:0;}",
      ".ev::before{content:'';position:absolute;left:-22px;top:6px;width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid " + p + ";}",
      ".ev.done::before{background:" + p + ";}",
      ".ev.recent::before{box-shadow:0 0 0 5px " + p + "22;}",
      ".ev-row{display:flex;justify-content:space-between;gap:12px;align-items:baseline;}",
      ".ev-title{font-weight:600;font-size:14px;color:#0f172a;}",
      ".ev.recent .ev-title{color:" + p + ";}",
      ".ev-date{font-size:12px;color:#94a3b8;white-space:nowrap;}",
      ".ev-desc{font-size:13px;color:#64748b;margin-top:2px;}",
      ".ev-badge{display:inline-block;font-size:10px;font-weight:700;color:" + p + ";background:" + p + "15;padding:2px 6px;border-radius:4px;margin-left:6px;text-transform:uppercase;letter-spacing:.06em;vertical-align:middle;}",
      ".footer-meta{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px;color:#94a3b8;}",
      ".muted{color:#64748b;font-size:13px;}",
      ".loading{text-align:center;padding:40px;color:#64748b;font-size:14px;}",
      ".tabs{display:inline-flex;background:#f1f5f9;border-radius:8px;padding:3px;gap:2px;}",
      ".tab{flex:1;padding:6px 14px;border:0;background:transparent;border-radius:6px;font:inherit;font-size:13px;color:#475569;cursor:pointer;font-weight:500;}",
      ".tab-on{background:#fff;color:" + p + ";box-shadow:0 1px 2px rgba(0,0,0,.06);font-weight:600;}",
      ".picker{display:flex;flex-direction:column;gap:10px;}",
      ".pick-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;text-align:left;font:inherit;transition:border-color .15s,background .15s;}",
      ".pick-item:hover{border-color:" + p + ";background:" + p + "08;}",
      ".pick-l{flex:1;min-width:0;}",
      ".pick-prod{font-weight:600;font-size:14px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".pick-meta{font-size:12px;color:#94a3b8;margin-top:2px;}",
      ".pick-arrow{color:" + p + ";font-weight:700;}",
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
    var explicitColor = host.getAttribute("data-cor");
    var primary = explicitColor || "#1d4ed8";

    var shadow = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var styleEl = document.createElement("style");
    styleEl.textContent = css(primary);
    shadow.appendChild(styleEl);

    var root = h("div", { class: "w" });
    shadow.appendChild(root);

    function applyPrimary(newColor) {
      if (!newColor || newColor === primary || explicitColor) return;
      primary = newColor;
      styleEl.textContent = css(primary);
    }

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

    // ===== Tela 1: formulário =====
    function viewForm() {
      var wrap = h("div", null);



      var grid = h("div", { class: "grid" });

      var modo = "email";
      var inpNum = h("input", { class: "input", placeholder: "Ex: 10234", autocomplete: "off" });
      var inpMail = h("input", { class: "input", type: "email", placeholder: "seu@email.com", autocomplete: "email" });
      var inpCpf = h("input", { class: "input", placeholder: "Somente números", inputmode: "numeric", maxlength: "14", style: "display:none;" });

      var tabEmail = h("button", { type: "button", class: "tab tab-on" }, "E-mail");
      var tabCpf = h("button", { type: "button", class: "tab" }, "CPF");
      var tabs = h("div", { class: "tabs" }, [tabEmail, tabCpf]);

      function setModo(m) {
        modo = m;
        if (m === "email") {
          tabEmail.className = "tab tab-on"; tabCpf.className = "tab";
          inpMail.style.display = ""; inpCpf.style.display = "none";
        } else {
          tabEmail.className = "tab"; tabCpf.className = "tab tab-on";
          inpMail.style.display = "none"; inpCpf.style.display = "";
        }
      }
      tabEmail.addEventListener("click", function () { setModo("email"); });
      tabCpf.addEventListener("click", function () { setModo("cpf"); });

      inpCpf.addEventListener("input", function () {
        inpCpf.value = (inpCpf.value || "").replace(/\D/g, "").slice(0, 11);
      });

      var btnLeft = h("button", { class: "btn" }, "Localizar pedido");
      var pedidoLabel = h("label", { class: "label" }, [
        document.createTextNode("Número do Pedido "),
        h("span", { class: "hint" }, "(opcional)"),
      ]);

      var leftCard = h("div", { class: "card" }, [
        pedidoLabel,
        inpNum,
        h("label", { class: "label" }, "Como deseja se identificar?"),
        tabs,
        inpMail,
        inpCpf,
        btnLeft,
      ]);

      btnLeft.addEventListener("click", function () {
        var num = (inpNum.value || "").trim();
        var params = { loja_id: lojaId };
        if (num) params.numero = num;
        if (modo === "email") {
          var mail = (inpMail.value || "").trim();
          if (!mail) { showError(leftCard, "Informe seu e-mail."); return; }
          params.email = mail;
        } else {
          var cpf = (inpCpf.value || "").replace(/\D/g, "");
          if (cpf.length !== 11) { showError(leftCard, "CPF deve ter 11 dígitos."); return; }
          params.cpf = cpf;
        }
        btnLeft.disabled = true; btnLeft.textContent = "Buscando...";
        api("/widget-buscar-pedido", params)
          .then(function (res) {
            btnLeft.disabled = false; btnLeft.textContent = "Localizar pedido";
            if (!res.ok) { showError(leftCard, res.data.error || "Pedido não encontrado."); return; }
            if (res.data.matches && res.data.matches.length) {
              viewPicker(res.data.matches);
            } else if (res.data.codigo_rastreio) {
              loadTracking(res.data.codigo_rastreio);
            } else {
              showError(leftCard, "Nenhum pedido encontrado.");
            }
          })
          .catch(function () {
            btnLeft.disabled = false; btnLeft.textContent = "Localizar pedido";
            showError(leftCard, "Falha de conexão. Tente novamente.");
          });
      });

      var inpCod = h("input", { class: "input", placeholder: "Ex: BR8A2F9C3D7EAT", autocomplete: "off" });
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

      [inpNum, inpMail, inpCpf].forEach(function (el) {
        el.addEventListener("keydown", function (e) { if (e.key === "Enter") btnLeft.click(); });
      });
      inpCod.addEventListener("keydown", function (e) { if (e.key === "Enter") btnRight.click(); });

      grid.appendChild(leftCard);
      grid.appendChild(h("div", { class: "sep" }, "Ou"));
      grid.appendChild(rightCard);
      wrap.appendChild(grid);
      render(wrap);
    }

    // ===== Tela 2: seletor (vários pedidos) =====
    function viewPicker(matches) {
      var wrap = h("div", null);
      wrap.appendChild(h("h2", { class: "title" }, "Selecione seu pedido"));
      wrap.appendChild(h("p", { class: "sub" }, "Encontramos " + matches.length + " pedidos com esse contato"));

      var box = h("div", { class: "picker" });
      matches.forEach(function (m) {
        var item = h("button", { class: "pick-item", type: "button" }, [
          h("div", { class: "pick-l" }, [
            h("div", { class: "pick-prod" }, formatProduto(m.produto)),
            h("div", { class: "pick-meta" }, fmtDate(m.created_at) + " · " + (m.codigo_rastreio || "")),
          ]),
          h("div", { class: "pick-arrow" }, "→"),
        ]);
        item.addEventListener("click", function () { loadTracking(m.codigo_rastreio); });
        box.appendChild(item);
      });

      var back = h("button", { class: "btn-ghost", style: "margin-top:14px;align-self:center;" }, "← Voltar");
      back.addEventListener("click", viewForm);
      box.appendChild(back);

      wrap.appendChild(box);
      render(wrap);
    }

    // ===== Tela 3: resultado =====
    function loadTracking(codigo) {
      render(h("div", { class: "loading" }, "Carregando rastreio..."));
      api("/rastreio-info", { codigo: codigo, loja_id: lojaId })
        .then(function (res) {
          if (!res.ok) {
            var v = h("div", null);
            v.appendChild(h("h2", { class: "title" }, "Rastreio"));
            v.appendChild(h("div", { class: "err" }, res.data.error || "Código não encontrado."));
            var back = h("button", { class: "btn-ghost", style: "margin-top:14px;" }, "← Voltar");
            back.addEventListener("click", viewForm);
            v.appendChild(back);
            render(v);
            return;
          }
          if (res.data.cor_primaria) applyPrimary(res.data.cor_primaria);
          renderResult(res.data, codigo);
        })
        .catch(function () {
          var v = h("div", null);
          v.appendChild(h("div", { class: "err" }, "Falha de conexão."));
          var back = h("button", { class: "btn-ghost", style: "margin-top:14px;" }, "← Voltar");
          back.addEventListener("click", viewForm);
          v.appendChild(back);
          render(v);
        });
    }

    function renderResult(data, codigo) {
      var envio = data.envio || {};
      var origem = data.origem || {};
      var eventos = (data.eventos || []).slice();
      var total = data.totalEventos || eventos.length || 1;
      var progress = Math.max(8, Math.min(100, Math.round(((envio.ultimo_evento_ordem || 0) / Math.max(total, 1)) * 100)));
      if (envio.status === "entregue") progress = 100;

      // Datas calculadas: created_at + delay_horas (do envio.created_at)
      var baseTs = envio.created_at ? new Date(envio.created_at).getTime() : Date.now();
      var eventosComData = eventos.map(function (e) {
        var ts = baseTs + (Number(e.delay_horas) || 0) * 3600 * 1000;
        return Object.assign({}, e, { ts: ts });
      }).sort(function (a, b) { return b.ts - a.ts; }); // mais recente primeiro

      var ultimaAtualizacao = eventosComData.length ? eventosComData[0].ts : (envio.updated_at ? new Date(envio.updated_at).getTime() : null);

      var origemTxt = origem.cidade ? (origem.cidade + (origem.estado ? "/" + origem.estado : "")) : "Centro de distribuição";
      var destinoTxt = envio.cliente_cidade ? (envio.cliente_cidade + (envio.cliente_estado ? "/" + envio.cliente_estado : "")) : "—";

      // ----- Card 1: header -----
      var codeBox = h("span", { class: "code" }, envio.codigo_rastreio || codigo);
      var cpyBtn = h("button", { class: "cpy", type: "button" }, "copiar");
      cpyBtn.addEventListener("click", function () {
        try {
          navigator.clipboard.writeText(envio.codigo_rastreio || codigo);
          cpyBtn.textContent = "copiado ✓";
          setTimeout(function () { cpyBtn.textContent = "copiar"; }, 1500);
        } catch (_) {}
      });

      var head = h("div", { class: "rhead" }, [
        h("div", { class: "rhead-l" }, [
          h("span", { class: "chip" }, statusLabel(envio.status)),
          h("div", { class: "prod" }, formatProduto(envio.produto)),
          h("div", { class: "codeline" }, [
            document.createTextNode("Código:"),
            codeBox,
            cpyBtn,
          ]),
        ]),
        h("div", { class: "carrier" }, [
          h("div", { class: "ico", html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>' }),
          h("div", null, [
            h("div", { class: "carrier-sub" }, "Transportadora"),
            h("div", { class: "carrier-name" }, envio.transportadora || "—"),
          ]),
        ]),
      ]);

      // ----- Bloco de rota -----
      var routeBar = h("div", { class: "bar" });
      routeBar.appendChild(h("i", { style: "width:" + progress + "%;" }));
      var route = h("div", { class: "route" }, [
        h("div", { class: "stop" }, [
          h("div", { class: "stop-label" }, "Origem"),
          h("div", { class: "stop-city" }, origemTxt),
        ]),
        h("div", { class: "arrow" }, [
          h("div", { class: "arrow-ico" }, "→"),
          routeBar,
          h("div", { style: "font-size:11px;color:#94a3b8;font-weight:600;" }, progress + "%"),
        ]),
        h("div", { class: "stop r" }, [
          h("div", { class: "stop-label" }, "Destino"),
          h("div", { class: "stop-city" }, destinoTxt),
        ]),
      ]);

      var destRow = h("div", { class: "dest-row" }, [
        h("div", null, [h("b", null, "Destinatário: "), document.createTextNode(envio.cliente_nome || "—")]),
        h("div", null, [h("b", null, "Pedido feito em: "), document.createTextNode(envio.created_at ? fmtDate(envio.created_at) : "—")]),
      ]);

      var card1 = h("div", { class: "rcard" }, [
        head,
        h("div", { style: "height:18px;" }),
        route,
        destRow,
      ]);

      // ----- Card 2: timeline -----
      var tl = h("div", { class: "timeline" });
      if (!eventosComData.length) {
        tl.appendChild(h("div", { class: "muted" }, "Nenhuma atualização ainda. Volte em breve."));
      } else {
        eventosComData.forEach(function (ev, i) {
          var node = h("div", { class: "ev done" + (i === 0 ? " recent" : "") });
          var titleRow = h("div", { class: "ev-row" }, [
            h("div", null, [
              h("span", { class: "ev-title" }, statusLabel(ev.status_label) || ev.nome || "Atualização"),
              i === 0 ? h("span", { class: "ev-badge" }, "Mais recente") : null,
            ]),
            h("div", { class: "ev-date" }, fmtDate(new Date(ev.ts).toISOString())),
          ]);
          node.appendChild(titleRow);
          if (ev.descricao) node.appendChild(h("div", { class: "ev-desc" }, ev.descricao));
          tl.appendChild(node);
        });
      }

      var card2 = h("div", { class: "rcard" }, [
        h("h3", { class: "tl-title" }, "Histórico de atualizações"),
        tl,
        h("div", { style: "height:14px;" }),
        h("div", { class: "footer-meta" }, [
          h("div", null, "Última atualização: " + (ultimaAtualizacao ? fmtDateLong(new Date(ultimaAtualizacao).toISOString()) : "—")),
          (function () {
            var back = h("button", { class: "btn-ghost" }, "← Nova consulta");
            back.addEventListener("click", viewForm);
            return back;
          })(),
        ]),
      ]);

      var wrap = h("div", { class: "result" }, [card1, card2]);
      render(wrap);
    }

    viewForm();
  }

  function init() {
    var nodes = document.querySelectorAll(".atlas-order-tracking, [data-atlas-tracking]");
    nodes.forEach(mount);
  }

  // Render imediato — não esperar DOMContentLoaded se os nodes já existem
  init();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  }

  // Observa apenas adições de novos nodes (não roda querySelectorAll a cada mutação)
  if (window.MutationObserver) {
    var mo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.matches && (n.matches(".atlas-order-tracking") || n.matches("[data-atlas-tracking]"))) {
            mount(n);
          } else if (n.querySelector && n.querySelector(".atlas-order-tracking, [data-atlas-tracking]")) {
            init();
            return;
          }
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

})();
