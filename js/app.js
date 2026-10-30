// VIRALX — shared app logic: splash, feed rendering, likes, comments, shares.
// Backend: Supabase (project "vyralx"). Falls back to DEMO seed content until
// js/config.js carries the project URL + publishable key.
(function () {
  var cfg = window.VX_CONFIG || {};
  var LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  var sb = null;
  // Sessions persist until the USER signs out — never auto-sign-out:
  // persistSession keeps the login on the device, autoRefreshToken renews it silently.
  if (LIVE && window.supabase) sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.VX = { sb: sb, live: LIVE, cfg: cfg };
  var ME = null; // signed-in user (or null), resolved on each feed render

  // ---- sound state: muted until the user turns sound on once; then it sticks ----
  var SOUND_ON = false;
  try { SOUND_ON = localStorage.getItem("vx_sound_on") === "1"; } catch (e) {}
  function setSound(on) {
    SOUND_ON = on;
    window.VX_SOUND_ON = on;
    try { localStorage.setItem("vx_sound_on", on ? "1" : "0"); } catch (e) {}
    document.querySelectorAll("#feed video").forEach(function (v) { v.muted = !on; });
    document.querySelectorAll("#feed .sound-btn .bubble").forEach(function (b) { b.textContent = on ? "🔊" : "🔇"; });
  }
  window.VX_setSound = setSound;

  // ---- splash ----
  window.addEventListener("load", function () {
    setTimeout(function () {
      var s = document.getElementById("splash");
      if (s) s.classList.add("hide");
    }, 1100);
  });

  // ---- title banner (uploaded logo art) ----
  document.addEventListener("DOMContentLoaded", function () {
    if (!window.VX_BANNER) return;
    document.querySelectorAll(".vx-banner-img").forEach(function (img) {
      img.src = window.VX_BANNER;
      img.classList.remove("hidden");
    });
    document.querySelectorAll(".vx-banner-fallback").forEach(function (el) {
      el.classList.add("hidden");
    });
  });

  // ---- demo seed (prototype content until real uploads land) ----
  var SEED = [
    {
      id: "seed-1", username: "keyzondabeatz37", verified: true,
      caption: "Chrome dragon over Brooklyn — made with BLACK DRAGON AI 🐉",
      tags: ["#viralx", "#brooklyn", "#ai"],
      video_url: "https://v3b.fal.media/files/b/0aafbf19/yq8Kc81ABSbPK24aLH3Sv_video.mp4",
      likes: 128, comments: 14, category: "entertainment"
    },
    {
      id: "seed-2", username: "keyzondabeatz37", verified: true,
      caption: "Same dragon, Cheap Zone render. From the block to the booth.",
      tags: ["#moneymotion", "#studio"],
      video_url: "https://v3b.fal.media/files/b/0aafbede/ZDYJD-vrKHMp7i-n-N1kw_bEqRryrk.mp4",
      likes: 86, comments: 9, category: "music"
    }
  ];

  // Sample comment threads for the two DEMO clips. Demo content only —
  // real uploads use the live comments table. Posting here stays on-device.
  var DEMO_THREADS = {
    "seed-1": [
      { user: "bdboss", body: "This dragon goes crazy 🐉🔥", when: "2h" },
      { user: "babysal198", body: "Brooklyn stand up!!", when: "5h" },
      { user: "keyz87", body: "Made this one with AI — more coming 👀", when: "5h" },
      { user: "bdboss", body: "The chrome on it is clean", when: "1h" },
      { user: "babysal198", body: "Need this as a music video intro", when: "44m" }
    ],
    "seed-2": [
      { user: "babysal198", body: "That zone render still 🔥", when: "3h" },
      { user: "bdboss", body: "From the block to the booth fr", when: "2h" },
      { user: "keyz87", body: "Cheap Zone did its thing on this one", when: "2h" },
      { user: "babysal198", body: "Run it back 🎬", when: "1h" }
    ]
  };
  // demo counts = the real number of sample comments, not invented totals
  SEED.forEach(function (v) { if (DEMO_THREADS[v.id]) v.comments = DEMO_THREADS[v.id].length; });

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function timeAgo(ts) {
    var sec = Math.max(1, (Date.now() - new Date(ts).getTime()) / 1000);
    if (sec < 60) return "now";
    if (sec < 3600) return Math.floor(sec / 60) + "m";
    if (sec < 86400) return Math.floor(sec / 3600) + "h";
    if (sec < 604800) return Math.floor(sec / 86400) + "d";
    return Math.floor(sec / 604800) + "w";
  }
  var toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "vx-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  // ================= COMMENTS =================
  var cPanel = null, cCurrent = null; // cCurrent = { v, wrap }
  function buildCommentsPanel() {
    if (cPanel) return cPanel;
    var root = document.createElement("div");
    root.className = "vx-comments-root hidden";
    root.innerHTML =
      '<div class="vx-c-overlay"></div>' +
      '<aside class="vx-c-panel" role="dialog" aria-label="Comments">' +
        '<div class="vx-c-head"><span class="vx-c-title">Comments</span><button class="vx-c-close" type="button" aria-label="Close">✕</button></div>' +
        '<div class="vx-c-list"></div>' +
        '<div class="vx-c-formwrap"></div>' +
      "</aside>";
    document.body.appendChild(root);
    root.querySelector(".vx-c-overlay").addEventListener("click", closeComments);
    root.querySelector(".vx-c-close").addEventListener("click", closeComments);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeComments(); });
    cPanel = root;
    return root;
  }
  function closeComments() { if (cPanel) cPanel.classList.add("hidden"); cCurrent = null; }
  function commentRow(c) {
    var mine = ME && c.user_id === ME.id;
    var name = (c.profiles && c.profiles.username) || "user";
    var av = (c.profiles && c.profiles.avatar_url)
      ? '<img src="' + esc(c.profiles.avatar_url) + '" alt="">'
      : esc(name.charAt(0).toUpperCase());
    var row = document.createElement("div");
    row.className = "vx-c-row";
    row.innerHTML =
      '<div class="vx-c-avatar">' + av + "</div>" +
      '<div class="vx-c-main"><div class="vx-c-meta">@' + esc(name) + ' <span>' + timeAgo(c.created_at) + "</span></div>" +
      '<div class="vx-c-body">' + esc(c.body) + "</div></div>" +
      (mine ? '<button class="vx-c-del" type="button" title="Delete your comment">✕</button>' : "");
    if (mine) {
      row.querySelector(".vx-c-del").addEventListener("click", async function () {
        var del = await sb.from("comments").delete().eq("id", c.id).eq("user_id", ME.id);
        if (del.error) { toast("Could not delete — try again"); return; }
        row.remove();
        bumpCommentCount(-1);
      });
    }
    return row;
  }
  // Attach profile info to rows WITHOUT a PostgREST embed — embeds of
  // profiles into videos/comments are ambiguous in this schema ("more than
  // one relationship") and error out, which is what hid all real content.
  async function attachProfiles(rows) {
    var ids = [];
    rows.forEach(function (r) { if (r.user_id && ids.indexOf(r.user_id) < 0) ids.push(r.user_id); });
    if (!ids.length) return;
    var pr = await sb.from("profiles").select("id,username,avatar_url,verified").in("id", ids);
    if (pr.error || !pr.data) return;
    var map = {};
    pr.data.forEach(function (p) { map[p.id] = p; });
    rows.forEach(function (r) { r.profiles = map[r.user_id] || null; });
  }
  function bumpCommentCount(delta) {
    if (!cCurrent) return;
    cCurrent.v.comments = Math.max(0, (cCurrent.v.comments || 0) + delta);
    var span = cCurrent.wrap.querySelector(".comment-count");
    if (span) span.textContent = cCurrent.v.comments;
    var title = cPanel.querySelector(".vx-c-title");
    if (title) title.textContent = "Comments · " + cCurrent.v.comments;
  }
  async function openComments(v, wrap) {
    buildCommentsPanel();
    cCurrent = { v: v, wrap: wrap };
    cPanel.classList.remove("hidden");
    var list = cPanel.querySelector(".vx-c-list");
    var formWrap = cPanel.querySelector(".vx-c-formwrap");
    cPanel.querySelector(".vx-c-title").textContent = "Comments · " + (v.comments || 0);
    list.innerHTML = "";
    formWrap.innerHTML = "";
    if (!v.uuid || !sb) {
      // DEMO clip: show its sample thread; posts stay local to this session
      var thread = (DEMO_THREADS[v.id] || []).slice();
      list.innerHTML = '<div class="vx-c-demo-note">Demo clip — sample comments. Real uploads get live comments from everyone.</div>';
      function drawDemo() {
        list.querySelectorAll(".vx-c-row").forEach(function (r) { r.remove(); });
        thread.forEach(function (c, idx) {
          var row = document.createElement("div");
          row.className = "vx-c-row";
          row.innerHTML =
            '<div class="vx-c-avatar">' + esc(c.user.charAt(0).toUpperCase()) + "</div>" +
            '<div class="vx-c-main"><div class="vx-c-meta">@' + esc(c.user) + " <span>" + esc(c.when) + "</span></div>" +
            '<div class="vx-c-body">' + esc(c.body) + "</div></div>" +
            (c.mine ? '<button class="vx-c-del" type="button" title="Delete your comment">✕</button>' : "");
          if (c.mine) row.querySelector(".vx-c-del").addEventListener("click", function () {
            thread.splice(idx, 1); v.comments = thread.length;
            var sp = wrap.querySelector(".comment-count"); if (sp) sp.textContent = v.comments;
            cPanel.querySelector(".vx-c-title").textContent = "Comments · " + v.comments;
            drawDemo();
          });
          list.appendChild(row);
        });
        list.scrollTop = list.scrollHeight;
      }
      drawDemo();
      formWrap.innerHTML =
        '<form class="vx-c-form"><input type="text" maxlength="500" placeholder="Add a comment…" autocomplete="off">' +
        '<button type="submit">Post</button></form>';
      var dForm = formWrap.querySelector("form");
      var dInput = dForm.querySelector("input");
      dForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var body = dInput.value.trim();
        if (!body) return;
        thread.push({ user: "you", body: body, when: "now", mine: true });
        v.comments = thread.length;
        var sp = wrap.querySelector(".comment-count"); if (sp) sp.textContent = v.comments;
        cPanel.querySelector(".vx-c-title").textContent = "Comments · " + v.comments;
        dInput.value = "";
        drawDemo();
      });
      return;
    }
    list.innerHTML = '<div class="vx-c-empty">Loading comments…</div>';
    var res = await sb.from("comments")
      .select("id,user_id,body,created_at")
      .eq("video_id", v.uuid).order("created_at", { ascending: true }).limit(300);
    if (res.data && res.data.length) await attachProfiles(res.data);
    if (!cCurrent || cCurrent.v !== v) return; // panel moved on
    list.innerHTML = "";
    if (res.error) {
      list.innerHTML = '<div class="vx-c-empty">Comments could not load right now.</div>';
    } else if (!res.data.length) {
      list.innerHTML = '<div class="vx-c-empty">No comments yet — be the first. 🔥</div>';
    } else {
      res.data.forEach(function (c) { list.appendChild(commentRow(c)); });
      list.scrollTop = list.scrollHeight;
    }
    if (!ME) {
      formWrap.innerHTML = '<a class="vx-c-signin" href="auth.html">Sign in to comment</a>';
      return;
    }
    formWrap.innerHTML =
      '<form class="vx-c-form"><input type="text" maxlength="500" placeholder="Add a comment…" autocomplete="off">' +
      '<button type="submit">Post</button></form>';
    var form = formWrap.querySelector("form");
    var input = form.querySelector("input");
    input.focus();
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var body = input.value.trim();
      if (!body) return;
      var btn = form.querySelector("button");
      btn.disabled = true;
      var ins = await sb.from("comments").insert({ user_id: ME.id, video_id: v.uuid, body: body })
        .select("id,user_id,body,created_at").single();
      btn.disabled = false;
      if (ins.error || !ins.data) { toast("Comment failed — try again"); return; }
      await attachProfiles([ins.data]);
      var empty = list.querySelector(".vx-c-empty");
      if (empty) empty.remove();
      list.appendChild(commentRow(ins.data));
      list.scrollTop = list.scrollHeight;
      input.value = "";
      bumpCommentCount(1);
    });
  }

  // ================= SHARE =================
  function shareVideo(v) {
    var url = location.origin + location.pathname + (v.uuid ? "?v=" + v.uuid : "");
    var text = (v.caption || "Watch this on VIRALX").slice(0, 90);
    if (navigator.share) {
      navigator.share({ title: "VIRALX", text: text, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { toast("Link copied — share it anywhere 🔗"); });
    } else {
      toast(url);
    }
  }

  // ================= POSTS =================
  function postEl(v) {
    var wrap = document.createElement("section");
    wrap.className = "post";
    wrap.dataset.vid = v.uuid || v.id || "";
    var initial = esc((v.username || "?").charAt(0).toUpperCase());
    wrap.innerHTML =
      '<video src="' + esc(v.video_url) + '" loop playsinline muted preload="metadata"></video>' +
      '<div class="shade"></div>' +
      '<div class="rail">' +
        '<div class="avatar-wrap"><div class="avatar">' + initial + "</div>" +
        ((v.uuid && v.owner && (!ME || ME.id !== v.owner)) ? '<button class="follow-btn" type="button" aria-label="Follow creator">+</button>' : "") +
        "</div>" +
        '<button class="like-btn"><span class="bubble">▲</span><span class="like-count">' + (v.likes || 0) + "</span></button>" +
        '<button class="comment-btn"><span class="bubble">💬</span><span class="comment-count">' + (v.comments || 0) + "</span></button>" +
        '<button class="save-btn"><span class="bubble">🔖</span><span>Save</span></button>' +
        '<button class="share-btn"><span class="bubble">↗</span><span>Share</span></button>' +
        '<button class="sound-btn"><span class="bubble">' + (SOUND_ON ? "🔊" : "🔇") + '</span><span>Sound</span></button>' +
      "</div>" +
      '<div class="meta">' +
        '<div class="user">@' + esc(v.username) + (v.verified ? ' <span class="verified">✔</span>' : "") + "</div>" +
        '<div class="caption">' + esc(v.caption) + ' <span class="tags">' + esc((v.tags || []).join(" ")) + "</span></div>" +
        '<a class="sound-line" href="sound.html?sid=' + encodeURIComponent(v.sound_id || ("orig:" + (v.uuid || v.id || ""))) + "&name=" + encodeURIComponent(v.sound_name || ("Original sound · @" + v.username)) + '">🎵 ' + esc(v.sound_name || ("Original sound · @" + v.username)) + "</a>" +
      "</div>";

    var video = wrap.querySelector("video");
    video.addEventListener("error", function () {
      if (wrap.classList.contains("dead")) return;
      wrap.classList.add("dead");
      var note = document.createElement("div");
      note.className = "vx-dead-note";
      note.textContent = "⚠ Video unavailable";
      wrap.appendChild(note);
    });
    video.muted = !SOUND_ON;
    video.addEventListener("click", function () {
      if (video.paused) { video.muted = !SOUND_ON; video.play(); } else { video.pause(); }
    });
    wrap.querySelector(".sound-btn").addEventListener("click", function () {
      setSound(!SOUND_ON);
      if (SOUND_ON && video.paused) video.play().catch(function () {});
    });

    // ---- like (real, persisted) ----
    var likeBtn = wrap.querySelector(".like-btn");
    var likeCountEl = likeBtn.querySelector(".like-count");
    var liked = !!v.myLike;
    var likeBusy = false;
    if (liked) likeBtn.classList.add("liked");
    likeBtn.addEventListener("click", async function () {
      if (!v.uuid || !sb) { // demo clip: local toggle only
        liked = !liked;
        likeBtn.classList.toggle("liked", liked);
        likeCountEl.textContent = (v.likes || 0) + (liked ? 1 : 0);
        return;
      }
      if (!ME) { location.href = "auth.html"; return; }
      if (likeBusy) return;
      likeBusy = true;
      if (liked) {
        var del = await sb.from("likes").delete().eq("user_id", ME.id).eq("video_id", v.uuid);
        if (!del.error) { liked = false; v.likes = Math.max(0, (v.likes || 0) - 1); }
      } else {
        var ins = await sb.from("likes").insert({ user_id: ME.id, video_id: v.uuid });
        if (!ins.error) { liked = true; v.likes = (v.likes || 0) + 1; }
      }
      likeBusy = false;
      likeBtn.classList.toggle("liked", liked);
      likeCountEl.textContent = v.likes;
    });

    // ---- comments ----
    wrap.querySelector(".comment-btn").addEventListener("click", function () { openComments(v, wrap); });

    // ---- share (per-video link) ----
    wrap.querySelector(".share-btn").addEventListener("click", function () { shareVideo(v); });

    // ---- save (bookmarks, real) ----
    var saveBtn = wrap.querySelector(".save-btn");
    var savedState = false;
    saveBtn.addEventListener("click", async function () {
      var label = saveBtn.querySelector("span:last-child");
      if (!LIVE || !sb || !v.uuid) {
        label.textContent = "Demo clip";
        setTimeout(function () { label.textContent = savedState ? "Saved ✓" : "Save"; }, 1600);
        return;
      }
      var u = (await sb.auth.getUser()).data.user;
      if (!u) { location.href = "auth.html"; return; }
      if (!savedState) {
        var ins = await sb.from("bookmarks").insert({ user_id: u.id, video_id: v.uuid });
        if (ins.error) { label.textContent = "Try again"; setTimeout(function () { label.textContent = "Save"; }, 1600); return; }
        savedState = true;
        saveBtn.classList.add("liked");
        label.textContent = "Saved ✓";
      } else {
        await sb.from("bookmarks").delete().eq("user_id", u.id).eq("video_id", v.uuid);
        savedState = false;
        saveBtn.classList.remove("liked");
        label.textContent = "Save";
      }
    });
    if (LIVE && sb && v.uuid) {
      sb.auth.getUser().then(async function (r) {
        var u = r.data.user; if (!u) return;
        var q = await sb.from("bookmarks").select("video_id").eq("user_id", u.id).eq("video_id", v.uuid).maybeSingle();
        if (q.data) {
          savedState = true;
          saveBtn.classList.add("liked");
          saveBtn.querySelector("span:last-child").textContent = "Saved ✓";
        }
      }).catch(function () {});
    }

    // ---- follow (real, persisted) ----
    var followBtn = wrap.querySelector(".follow-btn");
    if (followBtn && v.uuid && v.owner) {
      var following = !!v.myFollow;
      var folBusy = false;
      function drawFollow() {
        followBtn.textContent = following ? "✓" : "+";
        followBtn.classList.toggle("following", following);
      }
      drawFollow();
      followBtn.addEventListener("click", async function () {
        if (!ME) { location.href = "auth.html"; return; }
        if (folBusy) return;
        folBusy = true;
        if (following) {
          var delF = await sb.from("follows").delete().eq("follower_id", ME.id).eq("following_id", v.owner);
          if (!delF.error) following = false;
        } else {
          var insF = await sb.from("follows").insert({ follower_id: ME.id, following_id: v.owner });
          if (!insF.error) following = true;
        }
        folBusy = false;
        v.myFollow = following;
        drawFollow();
      });
    }
    return wrap;
  }

  // autoplay the post in view, pause the rest
  function watchFeed(feed) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var vid = e.target.querySelector("video");
        if (!vid) return;
        if (e.intersectionRatio > 0.6) { vid.muted = !SOUND_ON; vid.play().catch(function () {}); }
        else { vid.pause(); }
      });
    }, { threshold: [0, 0.6, 1] });
    feed.querySelectorAll(".post").forEach(function (p) { io.observe(p); });
  }

  window.VX_renderFeed = async function (category) {
    var feed = document.getElementById("feed");
    if (!feed) return;
    feed.innerHTML = "";
    ME = null;
    if (LIVE && sb) {
      var sess = await sb.auth.getSession();
      ME = (sess.data && sess.data.session) ? sess.data.session.user : null;
    }
    var videos = SEED;
    if (LIVE && sb) {
      var q = sb.from("videos").select("id,user_id,caption,hashtags,video_url,category,like_count,comment_count,created_at")
        .eq("status", "active").limit(30);
      var followingEmpty = false;
      if (category === "trending") {
        q = q.order("like_count", { ascending: false });
      } else if (category === "following") {
        if (!ME) {
          followingEmpty = true;
        } else {
          var fol = await sb.from("follows").select("following_id").eq("follower_id", ME.id);
          var ids = (fol.data || []).map(function (f) { return f.following_id; });
          if (ids.length) q = q.in("user_id", ids); else followingEmpty = true;
        }
        q = q.order("created_at", { ascending: false });
      } else {
        q = q.order("created_at", { ascending: false });
        if (category && category !== "foryou" && category !== "following") q = q.eq("category", category);
      }
      var res = await q;
      if (followingEmpty) {
        feed.innerHTML = '<div class="vx-empty-note">' + (ME ? "Follow creators and their videos will land here.<br>Tap + on any video to follow its creator." : "Sign in and follow creators to build this feed.") + "</div>";
        videos = [];
      } else if (!res.error && res.data && res.data.length) {
        await attachProfiles(res.data);
        var realMapped = res.data.filter(function (r) {
          // legacy AI clips point at temporary tunnel URLs that die within hours — never render those
          return (r.video_url || "").indexOf("lhr.life") < 0;
        }).map(function (r) {
          return {
            uuid: r.id, owner: r.user_id, username: (r.profiles && r.profiles.username) || "creator",
            verified: !!(r.profiles && r.profiles.verified), caption: r.caption || "",
            tags: r.hashtags || [], video_url: r.video_url, likes: r.like_count || 0,
            comments: r.comment_count || 0, category: r.category, myLike: false, myFollow: false,
            sound_name: r.sound_name || null, sound_id: r.sound_id || null
          };
        });
        videos = realMapped;
        // my likes, so hearts light up correctly
        if (ME) {
          var mine = await sb.from("likes").select("video_id").eq("user_id", ME.id)
            .in("video_id", videos.map(function (x) { return x.uuid; }));
          if (!mine.error && mine.data) {
            var set = {};
            mine.data.forEach(function (l) { set[l.video_id] = true; });
            videos.forEach(function (x) { x.myLike = !!set[x.uuid]; });
          }
        }
        // my follows, so follow buttons light up correctly
        if (ME) {
          var myf = await sb.from("follows").select("following_id").eq("follower_id", ME.id)
            .in("following_id", videos.map(function (x) { return x.owner; }));
          if (!myf.error && myf.data) {
            var fset = {};
            myf.data.forEach(function (f) { fset[f.following_id] = true; });
            videos.forEach(function (x) { x.myFollow = !!fset[x.owner]; });
          }
        }
        // demo clips ride along after the real uploads (category tabs filter them);
        // never on Following/Trending, which must stay true to real data
        var seedForTab = SEED;
        if (category && ["music", "gaming", "entertainment"].indexOf(category) >= 0) {
          seedForTab = SEED.filter(function (v) { return v.category === category; });
        }
        if (category !== "following" && category !== "trending") videos = videos.concat(seedForTab);
      }
    } else if (category && category !== "foryou") {
      videos = SEED.filter(function (v) { return v.category === category; });
      if (!videos.length) videos = SEED;
    }
    videos.forEach(function (v) { feed.appendChild(postEl(v)); });
    watchFeed(feed);
    // shared-link deep jump: ?v=<video id>
    var want = new URLSearchParams(location.search).get("v");
    if (want) {
      var target = feed.querySelector('[data-vid="' + want + '"]');
      if (target) setTimeout(function () { target.scrollIntoView(); }, 60);
    }
  };

  // feed tabs
  document.querySelectorAll(".feed-tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.getAttribute("data-cat") === "live") { location.href = "live.html"; return; }
      document.querySelectorAll(".feed-tabs button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      window.VX_renderFeed(b.getAttribute("data-cat"));
    });
  });
})();
