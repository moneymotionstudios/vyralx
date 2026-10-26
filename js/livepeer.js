// VIRALX house channel — Livepeer playback.
// Tries WebRTC (WHEP, ~1s latency) first, falls back to tuned HLS.
// Liveness is read from the HLS playlist body: Livepeer answers 200 with an
// EXT-X-ERROR playlist while idle, so the status code alone cannot be trusted.
(function () {
  var cfg = window.VX_CONFIG || {};
  var URL = (cfg.LIVEPEER_HLS || "").trim();
  var WHEP = (cfg.LIVEPEER_WHEP || "").trim();
  var video = document.getElementById("lp-player");
  var status = document.getElementById("lp-status");
  if (!URL || !video) return;
  var hls = null, pc = null, isLive = false, mode = "";

  function attachHls() {
    mode = "hls";
    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: true,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3,
        maxLiveSyncPlaybackRate: 1.5,
        maxBufferLength: 4
      });
      hls.loadSource(URL);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = URL;
    }
    status.textContent = "🔴 LIVE NOW (standard delay) — tap play.";
  }

  function attachWebrtc() {
    if (!WHEP || !window.RTCPeerConnection) { attachHls(); return; }
    mode = "webrtc";
    pc = new RTCPeerConnection();
    var gotTrack = false;
    var trV = pc.addTransceiver("video", { direction: "recvonly" });
    var trA = pc.addTransceiver("audio", { direction: "recvonly" });
    // Cut the receive jitter buffer to the floor — the biggest remaining
    // delay under our control on the playback side.
    [trV, trA].forEach(function (tr) {
      try { tr.receiver.jitterBufferTarget = 0; } catch (e) {}
    });
    pc.ontrack = function (ev) {
      try { ev.receiver.jitterBufferTarget = 0; } catch (e) {}
      gotTrack = true;
      if (ev.streams && ev.streams[0]) video.srcObject = ev.streams[0];
      video.play().catch(function () {});
      status.textContent = "🔴 LIVE NOW — ⚡ low latency (WebRTC).";
    };
    pc.createOffer().then(function (offer) { return pc.setLocalDescription(offer); }).then(function () {
      return new Promise(function (resolve) {
        if (pc.iceGatheringState === "complete") return resolve();
        var to = setTimeout(resolve, 2500);
        pc.addEventListener("icegatheringstatechange", function () {
          if (pc.iceGatheringState === "complete") { clearTimeout(to); resolve(); }
        });
      });
    }).then(function () {
      return fetch(WHEP, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription.sdp
      });
    }).then(function (r) {
      if (!r.ok) throw new Error("whep " + r.status);
      return r.text();
    }).then(function (sdp) {
      return pc.setRemoteDescription({ type: "answer", sdp: sdp });
    }).catch(function () {
      teardown();
      attachHls();
    });
    setTimeout(function () {
      if (mode === "webrtc" && !gotTrack) { teardown(); attachHls(); }
    }, 7000);
  }

  function teardown() {
    if (pc) { try { pc.close(); } catch (e) {} pc = null; }
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute("src");
    video.srcObject = null;
    mode = "";
  }

  function check() {
    fetch(URL, { cache: "no-store" }).then(function (r) { return r.text(); }).then(function (t) {
      var live = t.indexOf("#EXT-X-ERROR") === -1 && (t.indexOf("#EXTINF") !== -1 || t.indexOf("#EXT-X-STREAM-INF") !== -1);
      if (live && !isLive) {
        isLive = true;
        status.textContent = "🔴 LIVE NOW — connecting…";
        attachWebrtc();
      } else if (!live && isLive) {
        isLive = false;
        teardown();
        status.textContent = "The channel is offline right now — it lights up the moment the broadcast starts.";
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
