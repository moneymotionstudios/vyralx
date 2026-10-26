// VIRALX LIVE — watch page: HLS player (source/720p/480p), live chat,
// hearts and gifts over the streaming stack's WebSocket (see streaming/).
(function () {
  var cfg = window.VX_CONFIG || {};
  var HOST = (cfg.STREAM_HOST || "").trim();
  var off = document.getElementById("live-off");
  var on = document.getElementById("live-on");
  if (!HOST) { if (off) off.classList.remove("hidden"); return; }
  if (off) off.classList.add("hidden");
  if (on) on.classList.remove("hidden");

  var HLS = "http://" + HOST + ":8080/live/";
  document.getElementById("ingest-url").textContent = "rtmp://" + HOST + ":1935/live";

  var video = document.getElementById("player");
  var hls = null;
  var currentStream = "";
  var quality = "";

  function play(url) {
    if (hls) { hls.destroy(); hls = null; }
    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 4, liveSyncDurationCount: 2 });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    }
    video.play().catch(function () {});
  }

  function loadStream() {
    var name = document.getElementById("stream-name").value.trim();
    if (!name) return;
    currentStream = name;
    play(HLS + name + quality + ".m3u8");
    document.getElementById("now-watching").textContent = "Watching: " + name + (quality ? " (" + quality.slice(1) + ")" : " (source)");
    connectChat(name);
  }
  document.getElementById("watch-btn").addEventListener("click", loadStream);
  document.querySelectorAll("[data-q]").forEach(function (b) {
    b.addEventListener("click", function () {
      quality = b.getAttribute("data-q");
      document.querySelectorAll("[data-q]").forEach(function (x) { x.classList.remove("btn-green"); });
      b.classList.add("btn-green");
      if (currentStream) loadStream();
    });
  });

  // ---------- chat / hearts / gifts ----------
  var ws = null, hearts = 0;
  var log = document.getElementById("chat-log");
  function line(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  async function connectChat(streamId) {
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    var token = "";
    var sb = window.VX && window.VX.sb;
    if (sb) {
      var sess = await sb.auth.getSession();
      if (sess.data && sess.data.session) token = sess.data.session.access_token;
    }
    ws = new WebSocket("ws://" + HOST + ":8081" + (token ? "?token=" + encodeURIComponent(token) : ""));
    ws.onopen = function () { ws.send(JSON.stringify({ type: "join", streamId: streamId })); };
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.kind === "chat") line("<b>" + esc(m.name) + ":</b> " + esc(m.text));
      else if (m.kind === "hearts") { hearts += m.count; document.getElementById("heart-count").textContent = hearts; }
      else if (m.kind === "gift") line("🎁 <b>" + esc(m.name) + "</b> sent a " + esc(m.gift));
      else if (m.kind === "presence") document.getElementById("viewer-count").textContent = m.viewers;
      else if (m.kind === "error" && m.error === "rate_limited") line("<i>Slow down a second…</i>");
    };
    ws.onclose = function () { line("<i>Chat disconnected.</i>"); };
  }

  document.getElementById("chat-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var inp = document.getElementById("chat-input");
    var text = inp.value.trim();
    if (!text || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "chat", text: text }));
    inp.value = "";
  });
  document.getElementById("heart-btn").addEventListener("click", function () {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "heart", count: 1 }));
  });
  document.getElementById("gift-btn").addEventListener("click", function () {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "gift", gift: "dragon 🐉", coins: 0 }));
  });
})();
