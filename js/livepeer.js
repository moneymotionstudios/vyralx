// VYRALX house channel — Livepeer HLS playback with live/offline polling.
(function () {
  var cfg = window.VX_CONFIG || {};
  var URL = (cfg.LIVEPEER_HLS || "").trim();
  var video = document.getElementById("lp-player");
  var status = document.getElementById("lp-status");
  if (!URL || !video) return;
  var hls = null, isLive = false;

  function attach() {
    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 6, liveSyncDurationCount: 3 });
      hls.loadSource(URL);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = URL;
    }
  }
  function check() {
    // Livepeer answers 200 even when idle, with an EXT-X-ERROR playlist —
    // so liveness is decided by the playlist body, not the status code.
    fetch(URL, { cache: "no-store" }).then(function (r) { return r.text(); }).then(function (t) {
      var live = t.indexOf("#EXT-X-ERROR") === -1 && (t.indexOf("#EXTINF") !== -1 || t.indexOf("#EXT-X-STREAM-INF") !== -1);
      if (live && !isLive) {
        isLive = true;
        status.textContent = "🔴 LIVE NOW — tap play.";
        attach();
      } else if (!live && isLive) {
        isLive = false;
        status.textContent = "The channel is offline right now — it lights up the moment the broadcast starts.";
        if (hls) { hls.destroy(); hls = null; }
      } else if (!live) {
        status.textContent = "The channel is offline right now — it lights up the moment the broadcast starts.";
      }
    }).catch(function () {
      if (!isLive) status.textContent = "The channel is offline right now — it lights up the moment the broadcast starts.";
    });
  }
  check();
  setInterval(check, 20000);
})();
