// VIRALX LIVE discovery — real active creator rooms from live_streams.
// No fake broadcasts, no fake counts: only rows the backend marked live.
(function () {
  var sb = window.VX && window.VX.sb;
  var active = "all";
  var followingIds = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  async function load() {
    var box = document.getElementById("rooms");
    if (!box || !sb) return;
    var q = await sb.from("live_streams").select("*").eq("status", "live").order("viewer_count", { ascending: false });
    var rows = q.data || [];
    if (active === "following") {
      if (followingIds === null) {
        var u = (await sb.auth.getUser()).data.user;
        if (!u) { box.innerHTML = '<p class="muted">Sign in to see LIVE from people you follow.</p>'; return; }
        var f = await sb.from("follows").select("following_id").eq("follower_id", u.id);
        followingIds = (f.data || []).map(function (r) { return r.following_id; });
      }
      rows = rows.filter(function (r) { return followingIds.indexOf(r.host_id) !== -1; });
    } else if (active !== "all") {
      rows = rows.filter(function (r) { return r.category === active; });
    }
    if (!rows.length) {
      box.innerHTML = '<p class="muted">Nobody is LIVE in this category right now. Be the first — tap GO LIVE above.</p>';
      return;
    }
    box.innerHTML = "";
    for (var i = 0; i < rows.length; i++) {
      (function (r) {
        var a = document.createElement("a");
        a.href = "watch.html?stream=" + r.id;
        a.className = "card";
        a.style.cssText = "display:block;text-decoration:none;margin-bottom:10px;";
        a.innerHTML = '<span class="live-badge">LIVE</span> <b>' + esc(r.title) + "</b><br>" +
          '<span class="muted">' + esc(r.category) + " · 👁 " + (r.viewer_count || 0) + " watching · started " +
          esc(String(r.started_at || "").slice(11, 16)) + "</span>";
        box.appendChild(a);
      })(rows[i]);
    }
  }

  document.querySelectorAll("[data-cat]").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("[data-cat]").forEach(function (x) { x.classList.remove("btn-green"); });
      b.classList.add("btn-green");
      active = b.getAttribute("data-cat");
      load();
    });
  });

  if (sb) {
    sb.channel("vx-discovery").on("postgres_changes", { event: "*", schema: "public", table: "live_streams" }, function () { load(); }).subscribe();
  }
  load();
})();
