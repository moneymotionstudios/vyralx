// VIRALX PRO checkout — Cash App / Venmo / Chime manual flow via vx-pro.
// Order code goes in the payment note; the owner confirms in the panel
// below (owner accounts only) and Pro switches on.
(function () {
  var sb = window.VX && window.VX.sb;
  var cfg = window.VX_CONFIG || {};
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  async function call(body) {
    var sess = (await sb.auth.getSession()).data.session;
    var res = await fetch(cfg.SUPABASE_URL + "/functions/v1/vx-pro", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (sess ? sess.access_token : ""),
        "apikey": cfg.SUPABASE_ANON_KEY
      },
      body: JSON.stringify(body)
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
    return data;
  }

  function showOrder(order, pay) {
    var box = $("pro-order");
    var openBtn = pay && pay.link
      ? '<a class="btn btn-green btn-block" href="' + esc(pay.link) + '" target="_blank" rel="noopener">Open ' + esc(pay.label) + " — pay $14.99</a>"
      : '<p class="muted">Open the <b>Chime</b> app and send $14.99 to <b>' + esc(pay ? pay.handle : "") + "</b>.</p>";
    box.innerHTML =
      '<div style="border:1px solid #8BFF00;border-radius:12px;padding:14px;margin-top:12px;">' +
      '<p style="margin:0 0 4px;">Your order code — <b>put it in the payment note:</b></p>' +
      '<p style="font-size:24px;font-weight:900;letter-spacing:1px;margin:0 0 10px;">' + esc(order.order_code) + "</p>" +
      openBtn +
      '<p class="muted" style="font-size:13px;margin:10px 0 0;">Paying: <b>$14.99</b> to <b>' + esc(pay ? pay.handle : "") + "</b> (" + esc(pay ? pay.label : "") + '). After you pay, this order stays <b>pending</b> until Keyz confirms it — then your account turns PRO ⭐ automatically. Monthly renewal is by hand the same way.</p></div>';
  }

  function showOrders(orders) {
    if (!orders || !orders.length) { $("pro-orders").innerHTML = ""; return; }
    var html = '<h4 style="margin:16px 0 6px;">Your orders</h4>';
    orders.forEach(function (o) {
      var st = o.status === "paid" ? "✅ PRO active" : o.status === "cancelled" ? "Cancelled" : "⏳ Pending confirmation";
      html += '<p class="muted" style="margin:4px 0;">' + esc(o.order_code) + " · $" + esc(o.amount) + " · " + esc(o.method) + " · " + st + "</p>";
    });
    $("pro-orders").innerHTML = html;
  }

  async function ownerPanel() {
    try {
      var out = await call({ action: "pending" });
      var panel = $("owner-panel");
      panel.classList.remove("hidden");
      var list = $("owner-list");
      if (!out.orders.length) { list.innerHTML = '<p class="muted">No pending Pro payments.</p>'; return; }
      list.innerHTML = "";
      out.orders.forEach(function (o) {
        var row = document.createElement("div");
        row.style.cssText = "border-bottom:1px solid #1c211e;padding:10px 0;";
        row.innerHTML = "<b>" + esc(o.order_code) + "</b> · $" + esc(o.amount) + " · " + esc(o.method) +
          "<br><span class='muted'>@" + esc(o.username || "?") + " (" + esc(o.display_name || "") + ")</span>";
        var confirm = document.createElement("button");
        confirm.className = "btn btn-green"; confirm.textContent = "Paid — turn Pro on"; confirm.type = "button";
        confirm.style.marginRight = "8px";
        confirm.addEventListener("click", async function () {
          confirm.disabled = true;
          try { await call({ action: "confirm", order_id: o.id }); row.remove(); ownerPanel(); }
          catch (e) { alert(e.message); confirm.disabled = false; }
        });
        var cancel = document.createElement("button");
        cancel.className = "btn"; cancel.textContent = "Cancel"; cancel.type = "button";
        cancel.addEventListener("click", async function () {
          cancel.disabled = true;
          try { await call({ action: "cancel", order_id: o.id }); row.remove(); ownerPanel(); }
          catch (e) { alert(e.message); cancel.disabled = false; }
        });
        var btns = document.createElement("div");
        btns.style.marginTop = "8px";
        btns.appendChild(confirm); btns.appendChild(cancel);
        row.appendChild(btns);
        list.appendChild(row);
      });
    } catch (e) { /* not the owner — panel stays hidden */ }
  }

  (async function () {
    if (!sb) { $("pro-state").innerHTML = '<p class="muted">Pro checkout is warming up — try again in a moment.</p>'; return; }
    var u = (await sb.auth.getUser()).data.user;
    if (!u) {
      $("pro-state").innerHTML = '<p class="muted">Pro needs a VIRALX account first.</p><a class="btn btn-green btn-block" href="auth.html">Sign in / Create account</a>';
      return;
    }
    try {
      var mine = await call({ action: "mine" });
      if (mine.is_pro) {
        $("pro-state").innerHTML = '<p style="font-size:18px;"><b>⭐ You are VIRALX PRO</b></p><p class="muted">Pro since ' + esc(String(mine.pro_since || "").slice(0, 10)) + " — 100 AI generations a day, everything unlocked.</p>";
        showOrders(mine.orders);
      } else {
        $("pro-state").innerHTML = '<p class="muted">Signed in as <b>' + esc(u.email || "") + '</b>. One payment of $14.99 turns Pro on for a month.</p>';
        $("pro-methods").classList.remove("hidden");
        showOrders(mine.orders);
        var pending = (mine.orders || []).find(function (o) { return o.status === "pending"; });
        if (pending) {
          var labels = { cashapp: { label: "Cash App", handle: "$LYNXUNLIMITEDMUSIC", link: "https://cash.app/$LYNXUNLIMITEDMUSIC/14.99" }, venmo: { label: "Venmo", handle: "Keyz (VIRALX owner)", link: "https://venmo.com/code?user_id=4643723270948240531&created=1792792682" }, chime: { label: "Chime", handle: "$Johnnie-Gannaway", link: "" } };
          showOrder(pending, labels[pending.method]);
        }
      }
    } catch (e) {
      $("pro-state").innerHTML = '<p class="form-error">' + esc(e.message) + "</p>";
    }
    document.querySelectorAll("[data-method]").forEach(function (b) {
      b.addEventListener("click", async function () {
        b.disabled = true;
        try {
          var out = await call({ action: "create", method: b.getAttribute("data-method") });
          showOrder(out.order, out.pay);
          var mine2 = await call({ action: "mine" });
          showOrders(mine2.orders);
        } catch (e) { alert(e.message); }
        finally { b.disabled = false; }
      });
    });
    ownerPanel();
  })();
})();
