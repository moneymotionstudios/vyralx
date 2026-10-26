// VIRALX Saved Vault — bookmarked feed videos + personal image/video
// storage (Supabase buckets: images, videos under <uid>/). All rows are
// per-user (RLS); deleting removes the row and the stored file.
(function () {
  var sb = window.VX && window.VX.sb;
  var cfg = window.VX_CONFIG || {};
  var me = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pathFromUrl(url, bucket) {
    var marker = "/object/public/" + bucket + "/";
    var i = String(url).indexOf(marker);
    return i === -1 ? null : String(url).slice(i + marker.length);
  }

  async function loadBookmarks() {
    var box = $("saved-videos");
    var q = await sb.from("bookmarks").select("video_id, created_at").eq("user_id", me.id).order("created_at", { ascending: false });
    if (q.error || !q.data || !q.data.length) {
      box.innerHTML = '<p class="muted">Nothing saved yet — tap 🔖 Save on any feed video and it lands here.</p>';
      return;
    }
    var ids = q.data.map(function (b) { return b.video_id; });
    var vq = await sb.from("videos").select("id, video_url, caption, user_id").in("id", ids);
    var byId = {};
    (vq.data || []).forEach(function (v) { byId[v.id] = v; });
    box.innerHTML = "";
    q.data.forEach(function (b) {
      var v = byId[b.video_id];
      if (!v) return;
      var card = document.createElement("div");
      card.style.cssText = "margin-bottom:14px;";
      card.innerHTML = '<video src="' + esc(v.video_url) + '" controls playsinline preload="metadata" style="width:100%;border-radius:12px;background:#000;"></video>' +
        '<p class="muted" style="margin:6px 0;">' + esc(v.caption || "") + "</p>";
      var un = document.createElement("button");
      un.className = "btn"; un.type = "button"; un.textContent = "🗑️ Remove from saved";
      un.addEventListener("click", async function () {
        await sb.from("bookmarks").delete().eq("user_id", me.id).eq("video_id", b.video_id);
        card.remove();
        if (!box.children.length) loadBookmarks();
      });
      card.appendChild(un);
      box.appendChild(card);
    });
  }

  function mediaCell(m) {
    var cell = document.createElement("div");
    cell.className = "cell";
    if (m.kind === "image") {
      cell.innerHTML = '<img src="' + esc(m.url) + '" alt="">';
    } else {
      cell.innerHTML = '<video src="' + esc(m.url) + '" muted playsinline preload="metadata"></video>';
    }
    var del = document.createElement("button");
    del.className = "btn"; del.type = "button"; del.textContent = "🗑️";
    del.style.cssText = "position:absolute;right:6px;bottom:6px;padding:6px 10px;font-size:13px;";
    del.addEventListener("click", async function () {
      var bucket = m.kind === "image" ? "images" : "videos";
      var path = pathFromUrl(m.url, bucket);
      await sb.from("saved_media").delete().eq("id", m.id);
      if (path) { try { await sb.storage.from(bucket).remove([path]); } catch (e) {} }
      cell.remove();
    });
    cell.appendChild(del);
    return cell;
  }

  async function loadMedia() {
    var q = await sb.from("saved_media").select("*").eq("user_id", me.id).order("created_at", { ascending: false });
    var imgs = $("img-grid"), vids = $("vid-list");
    imgs.innerHTML = ""; vids.innerHTML = "";
    var anyV = false;
    (q.data || []).forEach(function (m) {
      if (m.kind === "image") imgs.appendChild(mediaCell(m));
      else {
        anyV = true;
        var wrap = document.createElement("div");
        wrap.style.cssText = "position:relative;margin-bottom:14px;";
        wrap.innerHTML = '<video src="' + esc(m.url) + '" controls playsinline preload="metadata" style="width:100%;border-radius:12px;background:#000;"></video>' +
          '<p class="muted" style="margin:6px 0;">' + esc(m.name || "Vault video") + "</p>";
        var del = document.createElement("button");
        del.className = "btn"; del.type = "button"; del.textContent = "🗑️ Delete from vault";
        del.addEventListener("click", async function () {
          var path = pathFromUrl(m.url, "videos");
          await sb.from("saved_media").delete().eq("id", m.id);
          if (path) { try { await sb.storage.from("videos").remove([path]); } catch (e) {} }
          wrap.remove();
        });
        wrap.appendChild(del);
        vids.appendChild(wrap);
      }
    });
    if (!anyV) vids.innerHTML = '<p class="muted">No private videos yet.</p>';
    if (!imgs.children.length) imgs.innerHTML = '<p class="muted" style="grid-column:1/-1;">No images yet.</p>';
  }

  async function upload(kind) {
    var input = kind === "image" ? $("img-file") : $("vid-file");
    var errEl = kind === "image" ? $("img-error") : $("vid-error");
    errEl.textContent = "";
    var file = input.files && input.files[0];
    if (!file) { errEl.textContent = "Pick a file first."; return; }
    var bucket = kind === "image" ? "images" : "videos";
    var ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    var path = me.id + "/" + (kind === "video" ? "vault-" : "") + Date.now() + "." + ext;
    var up = await sb.storage.from(bucket).upload(path, file, { upsert: false });
    if (up.error) { errEl.textContent = up.error.message; return; }
    var url = sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    var ins = await sb.from("saved_media").insert({ user_id: me.id, kind: kind, url: url, name: file.name });
    if (ins.error) { errEl.textContent = ins.error.message; return; }
    input.value = "";
    loadMedia();
  }

  $("img-upload").addEventListener("click", function () { upload("image"); });
  $("vid-upload").addEventListener("click", function () { upload("video"); });

  (async function () {
    if (!sb) return;
    var u = (await sb.auth.getUser()).data.user;
    if (!u) return;
    me = u;
    $("need-login").classList.add("hidden");
    $("vault").classList.remove("hidden");
    loadBookmarks();
    loadMedia();
  })();
})();
