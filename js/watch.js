// VIRALX watch room — subscribe-only LiveKit viewing, realtime comments,
// floating hearts (broadcast), TEST-coin gifts, guest requests, moderation.
(function () {
  var sb = window.VX && window.VX.sb;
  var cfg = window.VX_CONFIG || {};
  var LK = window.LivekitClient;
  var streamId = new URLSearchParams(location.search).get("stream") || "";
  var stream = null, me = null, myName = "", channel = null, room = null;
  var isHost = false, isMod = false, lastSent = 0, guestMode = false;
  var BANNED = ["spam", "free money", "crypto giveaway", "http://", "https://", "www."];

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
  function floatEmoji(e, big) {
    var layer = $("float-layer");
    var s = document.createElement("span");
    s.className = big ? "gift-pop" : "float-emoji";
    s.textContent = e;
    if (!big) s.style.left = (55 + Math.random() * 38) + "%";
    layer.appendChild(s);
    setTimeout(function () { s.remove(); }, big ? 2300 : 2700);
  }

  function attachRemote(track, participant) {
    if (track.kind !== "video") { track.attach(); return; }
    var grid = $("vgrid");
    var holder = document.createElement("div");
    holder.id = "tile-" + participant.identity + "-" + track.source;
    holder.style.cssText = "width:100%;height:100%;";
    var el = track.attach();
    holder.appendChild(el);
    grid.appendChild(holder);
    if (grid.children.length > 1) grid.classList.add("split");
  }
  function detachRemote(track, participant) {
    track.detach().forEach(function (el) { el.remove(); });
    var t = document.getElementById("tile-" + participant.identity + "-" + track.source);
    if (t) t.remove();
    var grid = $("vgrid");
    if (grid.children.length <= 1) grid.classList.remove("split");
  }

  async function connect(asGuest) {
    var tok = await fn("lk-token", { stream_id: streamId, role: asGuest ? "guest" : "viewer" });
    if (room) { try { await room.disconnect(); } catch (e) {} }
    room = new LK.Room({ adaptiveStream: true, dynacast: true });
    room.on(LK.RoomEvent.TrackSubscribed, attachRemote);
    room.on(LK.RoomEvent.TrackUnsubscribed, detachRemote);
    await room.connect(tok.url || cfg.LIVEKIT_URL, tok.token);
    if (asGuest) {
      await room.localParticipant.enableCameraAndMicrophone();
      var pub = room.localParticipant.getTrackPublication(LK.Track.Source.Camera);
      if (pub && pub.track) {
        var el = pub.track.attach();
        $("guest-preview").replaceWith(el);
        el.id = "guest-preview"; el.muted = true; el.autoplay = true; el.playsInline = true;
        el.style.width = "100%"; el.style.borderRadius = "12px";
      }
      guestMode = true;
      $("guest-live").classList.remove("hidden");
    }
  }

  function addComment(c, mine) {
    var log = $("comments");
    var d = document.createElement("div");
    d.id = "c-" + c.id;
    var del = "";
    if (mine || isHost || isMod) del = ' <a href="#" data-del="' + c.id + '" style="color:#ff5b4d;">✕</a>';
    var mute = "";
    if ((isHost || isMod) && !mine) mute = ' <a href="#" data-mute="' + c.user_id + '" style="color:#9DB3A4;">mute</a>';
    d.innerHTML = "<b>" + esc(c.username) + ":</b> " + esc(c.body) + del + mute;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  $("comments").addEventListener("click", async function (ev) {
    var del = ev.target.getAttribute && ev.target.getAttribute("data-del");
    var mute = ev.target.getAttribute && ev.target.getAttribute("data-mute");
    if (del) {
      ev.preventDefault();
      try { await sb.from("live_comments").delete().eq("id", del); var n = document.getElementById("c-" + del); if (n) n.remove(); }
      catch (e) {
        try { await fn("live-control", { action: "moderate", kind: "delete_comment", stream_id: streamId, comment_id: del }); var n2 = document.getElementById("c-" + del); if (n2) n2.remove(); } catch (e2) {}
      }
    }
    if (mute) {
      ev.preventDefault();
      try { await fn("live-control", { action: "moderate", kind: "mute", stream_id: streamId, target_user_id: mute }); alert("Viewer muted for this LIVE."); } catch (e) { alert(e.message); }
    }
  });

  $("cform").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    if (!me) { location.href = "auth.html"; return; }
    var now = Date.now();
    if (now - lastSent < 1200) return;
    var body = $("cinput").value.trim();
    if (!body) return;
    var low = body.toLowerCase();
    for (var i = 0; i < BANNED.length; i++) {
      if (low.indexOf(BANNED[i]) !== -1) { alert("That message was blocked by the spam filter (links / banned phrases)."); return; }
    }
    lastSent = now;
    var ins = await sb.from("live_comments").insert({ stream_id: streamId, user_id: me.id, username: myName, body: body.slice(0, 300) });
    if (ins.error) { alert(ins.error.message); return; }
    $("cinput").value = "";
  });

  $("heart").addEventListener("click", function () {
    if (channel) channel.send({ type: "broadcast", event: "heart", payload: {} });
    floatEmoji("❤️");
  });

  async function loadGifts() {
    var g = await sb.from("virtual_gifts").select("*").order("cost_coins", { ascending: true });
    var grid = $("gift-grid");
    grid.innerHTML = "";
    (g.data || []).forEach(function (gift) {
      var b = document.createElement("button");
      b.className = "btn"; b.type = "button";
      b.innerHTML = '<span style="font-size:24px;">' + esc(gift.emoji) + "</span><br>" + esc(gift.name) + "<br><span class='muted'>" + gift.cost_coins + " coins</span>";
      b.addEventListener("click", async function () {
        $("gift-error").textContent = "";
        try {
          var out = await fn("live-control", { action: "gift", stream_id: streamId, gift_id: gift.id });
          $("coin-balance").textContent = out.balance;
          if (channel) channel.send({ type: "broadcast", event: "gift", payload: { emoji: gift.emoji, name: gift.name, coins: gift.cost_coins, from: "@" + myName } });
          floatEmoji(gift.emoji, true);
        } catch (e) { $("gift-error").textContent = e.message; }
      });
      grid.appendChild(b);
    });
    try {
      var c = await fn("live-control", { action: "coins" });
      $("coin-balance").textContent = c.test_coins;
    } catch (e) { $("coin-balance").textContent = "—"; }
  }
  $("gift").addEventListener("click", function () {
    if (!me) { location.href = "auth.html"; return; }
    $("gift-sheet").classList.toggle("hidden");
    loadGifts();
  });

  $("share").addEventListener("click", async function () {
    var url = location.href;
    if (navigator.share) { try { await navigator.share({ title: document.title, url: url }); return; } catch (e) {} }
    try { await navigator.clipboard.writeText(url); this.textContent = "Link copied ✓"; } catch (e) {}
  });

  $("report").addEventListener("click", async function () {
    if (!me) { location.href = "auth.html"; return; }
    var reason = prompt("Why are you reporting this LIVE?");
    if (!reason) return;
    var ins = await sb.from("live_reports").insert({ stream_id: streamId, reporter_id: me.id, reported_user_id: stream.host_id, reason: reason.slice(0, 300) });
    alert(ins.error ? ins.error.message : "Report sent. Thank you.");
  });

  async function refreshFollowBtn() {
    if (!me || !stream) return;
    var f = await sb.from("follows").select("follower_id").eq("follower_id", me.id).eq("following_id", stream.host_id).maybeSingle();
    $("follow").textContent = f.data ? "Following ✓" : "Follow";
    $("follow").onclick = async function () {
      if (f.data) { await sb.from("follows").delete().eq("follower_id", me.id).eq("following_id", stream.host_id); }
      else { await sb.from("follows").insert({ follower_id: me.id, following_id: stream.host_id }); }
      refreshFollowBtn();
    };
  }

  $("guest").addEventListener("click", async function () {
    if (!me) { location.href = "auth.html"; return; }
    var ins = await sb.from("live_guest_requests").upsert({ stream_id: streamId, user_id: me.id, status: "pending" }, { onConflict: "stream_id,user_id" });
    $("guest-status").textContent = ins.error ? ins.error.message : "Guest request sent — waiting for the host to approve…";
  });
  $("guest-leave").addEventListener("click", async function () {
    await sb.from("live_guest_requests").update({ status: "left" }).eq("stream_id", streamId).eq("user_id", me.id);
    guestMode = false;
    $("guest-live").classList.add("hidden");
    connect(false).catch(function () {});
    $("guest-status").textContent = "You left the guest spot.";
  });

  window.addEventListener("beforeunload", function () {
    if (me && streamId) {
      try { fn("live-control", { action: "leave", stream_id: streamId }); } catch (e) {}
    }
  });

  (async function () {
    if (!sb) return;
    var s = await sb.from("live_streams").select("*").eq("id", streamId).maybeSingle();
    if (s.error || !s.data) { $("w-error").textContent = "That LIVE link is broken."; return; }
    stream = s.data;
    var host = await sb.from("profiles").select("username, display_name").eq("id", stream.host_id).maybeSingle();
    $("w-title").textContent = stream.title;
    $("w-host").innerHTML = "by <b>@" + esc(host.data ? host.data.username : "creator") + "</b> · " + esc(stream.category);
    if (stream.status !== "live") {
      $("w-badge").textContent = "ENDED";
      $("w-error").textContent = "This LIVE has ended.";
      return;
    }
    var u = (await sb.auth.getUser()).data.user;
    me = u || null;
    if (me) {
      var pr = await sb.from("profiles").select("username").eq("id", me.id).maybeSingle();
      myName = pr.data ? pr.data.username : "viewer";
      isHost = stream.host_id === me.id;
      var md = await sb.from("live_moderators").select("user_id").eq("stream_id", streamId).eq("user_id", me.id).maybeSingle();
      isMod = !!md.data;
      try { await fn("live-control", { action: "join", stream_id: streamId }); } catch (e) {}
    }

    channel = sb.channel("vx-live-" + streamId);
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "live_comments", filter: "stream_id=eq." + streamId }, function (p) {
      if (!document.getElementById("c-" + p.new.id)) addComment(p.new, me && p.new.user_id === me.id);
    });
    channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "live_comments" }, function (p) {
      var n = document.getElementById("c-" + p.old.id); if (n) n.remove();
    });
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_streams", filter: "id=eq." + streamId }, function (p) {
      $("w-stats").textContent = "👁 " + (p.new.viewer_count || 0);
      if (p.new.status === "ended") {
        // Close the room cleanly on the viewer side too.
        if (room) { try { room.disconnect(); } catch (e) {} room = null; }
        $("vgrid").innerHTML = "";
        $("w-badge").textContent = "ENDED";
        $("w-error").textContent = "The host ended this LIVE.";
      }
    });
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_guest_requests", filter: "stream_id=eq." + streamId }, function (p) {
      if (me && p.new.user_id === me.id) {
        if (p.new.status === "approved" && !guestMode) {
          $("guest-status").textContent = "The host approved you — joining with camera…";
          connect(true).catch(function (e) { $("guest-status").textContent = e.message; });
        }
        if (p.new.status === "declined") $("guest-status").textContent = "The host declined the guest request.";
        if (p.new.status === "left" && guestMode) $("guest-leave").click();
      }
    });
    channel.on("broadcast", { event: "heart" }, function () { floatEmoji("❤️"); });
    channel.on("broadcast", { event: "gift" }, function (p) {
      var g = p.payload || {};
      floatEmoji(g.emoji || "🎁", true);
    });
    channel.subscribe();

    var past = await sb.from("live_comments").select("*").eq("stream_id", streamId).order("created_at", { ascending: true }).limit(50);
    (past.data || []).forEach(function (c) { addComment(c, me && c.user_id === me.id); });
    $("w-stats").textContent = "👁 " + (stream.viewer_count || 0);
    refreshFollowBtn();

    if (!cfg.LIVEKIT_URL) { $("w-error").textContent = "The LIVE engine is still connecting — video starts the moment the LiveKit host is linked."; return; }
    try { await connect(false); }
    catch (e) { $("w-error").textContent = e.message || String(e); }
  })();
})();
