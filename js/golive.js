// VIRALX GO LIVE — broadcaster. Camera/mic preview, LiveKit publish,
// comments + guest requests + gifts via Supabase, END LIVE summary.
(function () {
  var sb = window.VX && window.VX.sb;
  var cfg = window.VX_CONFIG || {};
  var LK = window.LivekitClient;
  var me = null, myName = "", isPro = false;
  var stream = null, room = null, localTracks = [], facing = "user", micOn = true;
  var startedAt = 0, timer = null, viewers = 0, giftTotal = 0;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  async function fn(name, body) {
    var sess = (await sb.auth.getSession()).data.session;
    var res = await fetch(cfg.SUPABASE_URL + "/functions/v1/" + name, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (sess ? sess.access_token : ""), "apikey": cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
    return data;
  }
  function resFor(q) {
    return q === "720" ? { width: 720, height: 1280, frameRate: 30 } : q === "360" ? { width: 360, height: 640, frameRate: 30 } : { width: 540, height: 960, frameRate: 30 };
  }
  function floatEmoji(e) {
    var layer = $("float-layer"); if (!layer) return;
    var s = document.createElement("span");
    s.className = "float-emoji"; s.textContent = e;
    s.style.left = (8 + Math.random() * 78) + "%";
    layer.appendChild(s);
    setTimeout(function () { s.remove(); }, 2700);
  }

  async function startPreview() {
    try {
      localTracks.forEach(function (t) { t.stop(); });
      localTracks = await LK.createLocalTracks({ audio: true, video: { resolution: resFor($("quality").value), facingMode: facing } });
      var v = localTracks.find(function (t) { return t.kind === "video"; });
      if (v) v.attach($("preview"));
      var a = localTracks.find(function (t) { return t.kind === "audio"; });
      if (a && !micOn) a.mute();
    } catch (e) {
      $("go-error").textContent = "Camera/mic blocked — allow access in the browser, then reload.";
    }
  }

  $("flip").addEventListener("click", async function () {
    facing = facing === "user" ? "environment" : "user";
    if (room && stream) {
      // live flip: swap the published video track
      try {
        var pub = room.localParticipant.getTrackPublication(LK.Track.Source.Camera);
        var nt = await LK.createLocalVideoTrack({ resolution: resFor($("quality").value), facingMode: facing });
        if (pub && pub.track) { await room.localParticipant.unpublishTrack(pub.track); pub.track.stop(); }
        await room.localParticipant.publishTrack(nt, { simulcast: true });
        nt.attach($("preview"));
      } catch (e) { /* keep current camera */ }
    } else {
      startPreview();
    }
  });
  $("mic").addEventListener("click", async function () {
    micOn = !micOn;
    this.textContent = micOn ? "🎙️ Mic: on" : "🔇 Mic: off";
    if (room) { try { await room.localParticipant.setMicrophoneEnabled(micOn); } catch (e) {} }
    else {
      var a = localTracks.find(function (t) { return t.kind === "audio"; });
      if (a) { micOn ? a.unmute() : a.mute(); }
    }
  });
  $("quality").addEventListener("change", function () { if (!stream) startPreview(); });
  $("pro-toggle").addEventListener("change", function () {
    $("pro-overlay").classList.toggle("hidden", !this.checked);
  });

  $("start").addEventListener("click", async function () {
    var err = $("go-error"); err.textContent = "";
    if (!cfg.LIVEKIT_URL) { err.textContent = "The LIVE engine is still connecting — try again shortly."; return; }
    var btn = this; btn.disabled = true; btn.textContent = "Starting…";
    try {
      var out = await fn("live-control", { action: "start", title: $("title").value.trim(), category: $("category").value });
      stream = out.stream;
      var tok = await fn("lk-token", { stream_id: stream.id, role: "host" });
      room = new LK.Room({ adaptiveStream: true, dynacast: true });
      room.on(LK.RoomEvent.Disconnected, function () { /* host ended or dropped */ });
      await room.connect(tok.url || cfg.LIVEKIT_URL, tok.token);
      for (var i = 0; i < localTracks.length; i++) {
        var t = localTracks[i];
        await room.localParticipant.publishTrack(t, t.kind === "video" ? { simulcast: true } : undefined);
      }
      if (!micOn) { try { await room.localParticipant.setMicrophoneEnabled(false); } catch (e) {} }
      startedAt = Date.now();
      $("setup-form").classList.add("hidden");
      $("stage-badge").classList.remove("hidden");
      $("stage-stats").classList.remove("hidden");
      $("live-ui").classList.remove("hidden");
      timer = setInterval(function () {
        var s = Math.floor((Date.now() - startedAt) / 1000);
        $("stage-stats").textContent = "👁 " + viewers + " · " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      }, 1000);
      subscribeRealtime();
    } catch (e) {
      err.textContent = e.message || String(e);
      btn.disabled = false; btn.textContent = "🔴 GO LIVE";
    }
  });

  function subscribeRealtime() {
    var ch = sb.channel("vx-live-" + stream.id);
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "live_comments", filter: "stream_id=eq." + stream.id }, function (p) {
      addComment(p.new);
    });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_streams", filter: "id=eq." + stream.id }, function (p) {
      viewers = p.new.viewer_count || 0;
    });
    ch.on("postgres_changes", { event: "*", schema: "public", table: "live_guest_requests", filter: "stream_id=eq." + stream.id }, function () {
      loadGuests();
    });
    ch.on("broadcast", { event: "heart" }, function () { floatEmoji("❤️"); });
    ch.on("broadcast", { event: "gift" }, function (p) {
      var g = p.payload || {};
      floatEmoji(g.emoji || "🎁");
      giftTotal += g.coins || 0;
      var feed = $("gift-feed");
      var d = document.createElement("p");
      d.className = "muted"; d.style.margin = "4px 0";
      d.textContent = (g.from || "Someone") + " sent " + (g.emoji || "") + " " + (g.name || "a gift") + " (" + (g.coins || 0) + " test coins)";
      if (feed.querySelector("p.muted") && feed.children.length === 1) feed.innerHTML = "";
      feed.prepend(d);
    });
    ch.subscribe();
    loadGuests();
  }

  function addComment(c) {
    var log = $("comments");
    var d = document.createElement("div");
    d.innerHTML = "<b>" + esc(c.username) + ":</b> " + esc(c.body);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  async function loadGuests() {
    var q = await sb.from("live_guest_requests").select("*").eq("stream_id", stream.id).order("created_at", { ascending: true });
    var box = $("guests");
    if (q.error || !q.data) return;
    var pending = q.data.filter(function (g) { return g.status === "pending"; });
    var approved = q.data.filter(function (g) { return g.status === "approved"; });
    if (!pending.length && !approved.length) { box.innerHTML = '<p class="muted">No requests yet. Viewers can ask to join you on camera.</p>'; return; }
    box.innerHTML = "";
    pending.concat(approved).forEach(function (g) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #1c211e;";
      var label = document.createElement("span");
      label.style.flex = "1";
      label.textContent = "Guest " + g.user_id.slice(0, 8) + " — " + g.status;
      row.appendChild(label);
      if (g.status === "pending") {
        var ok = document.createElement("button");
        ok.className = "btn btn-green"; ok.type = "button"; ok.textContent = "Approve";
        ok.addEventListener("click", async function () {
          await sb.from("live_guest_requests").update({ status: "approved" }).eq("id", g.id);
          loadGuests();
        });
        var no = document.createElement("button");
        no.className = "btn"; no.type = "button"; no.textContent = "Decline";
        no.addEventListener("click", async function () {
          await sb.from("live_guest_requests").update({ status: "declined" }).eq("id", g.id);
          loadGuests();
        });
        row.appendChild(ok); row.appendChild(no);
      }
      if (g.status === "approved") {
        var rm = document.createElement("button");
        rm.className = "btn"; rm.type = "button"; rm.textContent = "Remove";
        rm.addEventListener("click", async function () {
          try { await fn("live-control", { action: "moderate", kind: "remove_guest", stream_id: stream.id, target_user_id: g.user_id }); } catch (e) {}
          loadGuests();
        });
        row.appendChild(rm);
      }
      box.appendChild(row);
    });
  }

  $("end").addEventListener("click", async function () {
    if (!stream) return;
    this.disabled = true;
    try { await room && room.disconnect(); } catch (e) {}
    try {
      var out = await fn("live-control", { action: "end", stream_id: stream.id });
      var mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      var s = $("summary");
      s.classList.remove("hidden");
      s.innerHTML = "<h3 style='margin-top:0;'>LIVE ended</h3><p class='muted'>On air ~" + mins + " min · Peak viewers: " + (out.peak_viewers || 0) + " · Gifts: " + giftTotal + " test coins</p><a class='btn btn-green' href='live.html'>Back to LIVE</a>";
    } catch (e) { alert(e.message); }
    clearInterval(timer);
    stream = null;
  });

  (async function () {
    if (!sb || !LK) return;
    var u = (await sb.auth.getUser()).data.user;
    if (!u) return;
    me = u;
    var pr = await sb.from("profiles").select("username, is_pro").eq("id", u.id).maybeSingle();
    if (pr.data) {
      myName = pr.data.username; isPro = !!pr.data.is_pro;
      $("ov-name").textContent = "@" + myName;
      if (isPro) $("pro-wrap").style.display = "inline-flex";
    }
    $("need-login").classList.add("hidden");
    $("setup").classList.remove("hidden");
    if (!cfg.LIVEKIT_URL) $("engine-note").textContent = "LIVE engine connecting — the GO LIVE button unlocks the moment the LiveKit host is linked.";
    startPreview();
  })();
})();
