// VIRALX AI Chat — free OpenRouter models via the vx-chat Edge Function.
(function () {
  var sb = window.VX && window.VX.sb;
  var cfg = window.VX_CONFIG || {};
  var MODELS = [
    ["openrouter/free", "Free Models Router (auto-picks)"],
    ["google/gemma-4-31b-it:free", "Gemma 4 31B"],
    ["google/gemma-4-26b-a4b-it:free", "Gemma 4 26B"],
    ["nvidia/nemotron-3-ultra-550b-a55b:free", "Nemotron 3 Ultra 550B"],
    ["nvidia/nemotron-3-super-120b-a12b:free", "Nemotron 3 Super 120B"],
    ["nvidia/nemotron-3.5-super-vl:free", "Nemotron 3.5 Super VL"],
    ["nvidia/nemotron-3.5-lightning:free", "Nemotron 3.5 Lightning"],
    ["nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "Nemotron 3 Nano Omni"],
    ["poolside/laguna-s-2.1:free", "Laguna S 2.1"],
    ["poolside/laguna-xs-2.1:free", "Laguna XS 2.1"],
    ["cohere/north-mini-code:free", "North Mini Code"],
    ["recursive/flint-v1.0:free", "Flint v1.0"],
    ["xingchen-agi/xing4.0-29b-a4b:free", "Xingchen 4.0"],
    ["dots-studio/dots-3-note-preview:free", "Dots 3 Note"],
    ["liquid/lfm-2.5-2.6b:free", "LFM 2.5"]
  ];
  var history = [];
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var sel = $("model");
  MODELS.forEach(function (m) {
    var o = document.createElement("option");
    o.value = m[0]; o.textContent = m[1];
    sel.appendChild(o);
  });
  function line(who, text) {
    var d = document.createElement("div");
    d.innerHTML = "<b>" + esc(who) + ":</b> " + esc(text);
    $("log").appendChild(d);
    $("log").scrollTop = $("log").scrollHeight;
  }
  $("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var inp = $("input");
    var text = inp.value.trim();
    if (!text) return;
    $("chat-error").textContent = "";
    line("You", text);
    history.push({ role: "user", content: text });
    inp.value = "";
    var btn = $("send"); btn.disabled = true; btn.textContent = "…";
    try {
      var sess = (await sb.auth.getSession()).data.session;
      var res = await fetch(cfg.SUPABASE_URL + "/functions/v1/vx-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + (sess ? sess.access_token : ""),
          "apikey": cfg.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ model: sel.value, messages: history.slice(-20) })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
      history.push({ role: "assistant", content: data.reply });
      line("AI", data.reply);
    } catch (ex) {
      history.pop();
      $("chat-error").textContent = ex.message || String(ex);
    } finally { btn.disabled = false; btn.textContent = "Send"; }
  });
  (async function () {
    if (!sb) return;
    var u = (await sb.auth.getUser()).data.user;
    if (!u) return;
    $("need-login").classList.add("hidden");
    $("chat-ui").classList.remove("hidden");
    line("AI", "Tell me your video idea and I'll write you a ready-to-paste AI Studio prompt — or ask for captions, hooks and hashtags.");
  })();
})();
