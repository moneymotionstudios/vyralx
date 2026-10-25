// VYRALX — shared app logic: splash, feed rendering, likes, backend wiring.
// Backend: Supabase (project "vyralx"). Falls back to DEMO seed content until
// js/config.js carries the project URL + publishable key.
(function () {
  var cfg = window.VX_CONFIG || {};
  var LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  var sb = null;
  if (LIVE && window.supabase) sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  window.VX = { sb: sb, live: LIVE, cfg: cfg };

  // ---- splash ----
  window.addEventListener("load", function () {
    setTimeout(function () {
      var s = document.getElementById("splash");
      if (s) s.classList.add("hide");
    }, 1100);
  });

  // ---- demo seed (prototype content until real uploads land) ----
  var SEED = [
    {
      id: "seed-1", username: "keyzondabeatz37", verified: true,
      caption: "Chrome dragon over Brooklyn — made with BLACK DRAGON AI 🐉",
      tags: ["#vyralx", "#brooklyn", "#ai"],
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

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function postEl(v) {
    var wrap = document.createElement("section");
    wrap.className = "post";
    var initial = esc((v.username || "?").charAt(0).toUpperCase());
    wrap.innerHTML =
      '<video src="' + esc(v.video_url) + '" loop playsinline muted preload="metadata"></video>' +
      '<div class="shade"></div>' +
      '<div class="rail">' +
        '<div class="avatar">' + initial + "</div>" +
        '<button class="like-btn"><span class="bubble">▲</span><span class="like-count">' + (v.likes || 0) + "</span></button>" +
        '<button class="comment-btn"><span class="bubble">💬</span><span>' + (v.comments || 0) + "</span></button>" +
        '<button class="save-btn"><span class="bubble">🔖</span><span>Save</span></button>' +
        '<button class="share-btn"><span class="bubble">↗</span><span>Share</span></button>' +
      "</div>" +
      '<div class="meta">' +
        '<div class="user">@' + esc(v.username) + (v.verified ? ' <span class="verified">✔</span>' : "") + "</div>" +
        '<div class="caption">' + esc(v.caption) + ' <span class="tags">' + esc((v.tags || []).join(" ")) + "</span></div>" +
      "</div>";

    var video = wrap.querySelector("video");
    video.addEventListener("click", function () {
      if (video.paused) { video.muted = false; video.play(); } else { video.pause(); }
    });
    var likeBtn = wrap.querySelector(".like-btn");
    var liked = false;
    likeBtn.addEventListener("click", function () {
      liked = !liked;
      likeBtn.classList.toggle("liked", liked);
      likeBtn.querySelector(".like-count").textContent = (v.likes || 0) + (liked ? 1 : 0);
      if (LIVE && sb && v.uuid) {
        // real like wiring lands with auth session (Phase 2 completion)
      }
    });
    wrap.querySelector(".share-btn").addEventListener("click", function () {
      var url = location.href;
      if (navigator.share) navigator.share({ title: "VYRALX", url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url);
    });
    return wrap;
  }

  // autoplay the post in view, pause the rest
  function watchFeed(feed) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var vid = e.target.querySelector("video");
        if (!vid) return;
        if (e.intersectionRatio > 0.6) { vid.play().catch(function () {}); }
        else { vid.pause(); }
      });
    }, { threshold: [0, 0.6, 1] });
    feed.querySelectorAll(".post").forEach(function (p) { io.observe(p); });
  }

  window.VX_renderFeed = async function (category) {
    var feed = document.getElementById("feed");
    if (!feed) return;
    feed.innerHTML = "";
    var videos = SEED;
    if (LIVE && sb) {
      var q = sb.from("videos").select("id,user_id,caption,hashtags,video_url,category,like_count,comment_count,created_at,profiles(username,verified)")
        .eq("status", "active").order("created_at", { ascending: false }).limit(30);
      if (category && category !== "foryou") q = q.eq("category", category);
      var res = await q;
      if (!res.error && res.data && res.data.length) {
        videos = res.data.map(function (r) {
          return {
            uuid: r.id, username: (r.profiles && r.profiles.username) || "creator",
            verified: !!(r.profiles && r.profiles.verified), caption: r.caption || "",
            tags: r.hashtags || [], video_url: r.video_url, likes: r.like_count || 0,
            comments: r.comment_count || 0, category: r.category
          };
        });
      }
    } else if (category && category !== "foryou") {
      videos = SEED.filter(function (v) { return v.category === category; });
      if (!videos.length) videos = SEED;
    }
    videos.forEach(function (v) { feed.appendChild(postEl(v)); });
    watchFeed(feed);
  };

  // feed tabs
  document.querySelectorAll(".feed-tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".feed-tabs button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      window.VX_renderFeed(b.getAttribute("data-cat"));
    });
  });
})();
