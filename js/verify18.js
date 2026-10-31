// VIRALX — PRO 18+ identity verification.
// PRO members only. The member uploads (1) a photo of their government ID
// and (2) a selfie holding that ID. Files go to the PRIVATE id-docs bucket
// (own folder only, no public read). The owner reviews them in the
// Supabase dashboard and flips profiles.age_verified by hand.
(function () {
  var body = document.getElementById("v18-body");
  if (!body) return;
  var sb = window.VX && window.VX.sb;
  function esc(s) { return String(s == null ? "" : s).replace(/</g, "&lt;"); }
  function note(html) { body.innerHTML = html; }
  async function toJpeg(file, maxSide) {
    try {
      var bmp = await createImageBitmap(file);
      var scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise(function (res) { c.toBlob(res, "image/jpeg", 0.85); });
    } catch (e) { return null; }
  }
  (async function () {
    if (!sb) { note('<p class="muted">Verification needs the VIRALX backend — try again in a moment.</p>'); return; }
    var u = (await sb.auth.getUser()).data.user;
    if (!u) { note('<p class="muted"><a href="auth.html">Sign in</a> to verify — 18+ verification is for PRO accounts.</p>'); return; }
    var pr = await sb.from("profiles").select("is_pro, age_verified").eq("id", u.id).maybeSingle();
    var p = pr.data || {};
    if (p.age_verified) {
      note('<p style="font-size:17px;">🔞 <b>18+ Verified ✓</b></p><p class="muted">Your verified badge shows on your page. The 18+ area unlocks for verified PRO members.</p>');
      return;
    }
    if (!p.is_pro) {
      note('<p class="muted">18+ verification is a <b>PRO-only</b> feature. Go Pro above first — then come back here and verify it\'s really you.</p>');
      return;
    }
    var rows = await sb.from("id_verifications").select("status, created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(1);
    var last = rows.data && rows.data[0];
    if (last && last.status === "pending") {
      note('<p>⏳ <b>Under review.</b></p><p class="muted">Your ID + selfie were received on ' + new Date(last.created_at).toLocaleDateString() + '. The owner checks them by hand — your 🔞 badge lands as soon as you\'re approved.</p>');
      return;
    }
    note(
      (last && last.status === "rejected" ? '<p class="form-error">Your last submission couldn\'t be approved — check the photos are clear and the ID matches your selfie, then send them again.</p>' : "") +
      '<p class="muted">Prove it\'s really you — two photos:</p>' +
      '<p style="margin:8px 0 4px;"><b>1.</b> Your government ID (driver\'s license or passport)</p>' +
      '<label class="btn" for="v18-id" style="cursor:pointer;">🪪 Upload ID photo</label>' +
      '<input id="v18-id" type="file" accept="image/*" class="hidden"><span class="muted" id="v18-id-name" style="font-size:12px;margin-left:8px;"></span>' +
      '<p style="margin:12px 0 4px;"><b>2.</b> A selfie of you <b>holding that same ID</b> next to your face</p>' +
      '<label class="btn" for="v18-selfie" style="cursor:pointer;">🤳 Upload selfie holding ID</label>' +
      '<input id="v18-selfie" type="file" accept="image/*" class="hidden"><span class="muted" id="v18-selfie-name" style="font-size:12px;margin-left:8px;"></span>' +
      '<p class="muted" style="font-size:12px;margin-top:12px;">🔒 Private: both photos go into a locked vault only the VIRALX owner can open for review. They never appear on your page or anywhere public.</p>' +
      '<p class="form-error" id="v18-err"></p>' +
      '<button class="btn btn-green btn-block" id="v18-submit" type="button">Submit for review</button>'
    );
    var idFile = null, selfieFile = null;
    document.getElementById("v18-id").addEventListener("change", function (e) {
      idFile = e.target.files && e.target.files[0];
      document.getElementById("v18-id-name").textContent = idFile ? " ✓ " + esc(idFile.name) : "";
    });
    document.getElementById("v18-selfie").addEventListener("change", function (e) {
      selfieFile = e.target.files && e.target.files[0];
      document.getElementById("v18-selfie-name").textContent = selfieFile ? " ✓ " + esc(selfieFile.name) : "";
    });
    document.getElementById("v18-submit").addEventListener("click", async function () {
      var err = document.getElementById("v18-err");
      err.textContent = "";
      if (!idFile || !selfieFile) { err.textContent = "Both photos are needed — your ID, and a selfie holding it."; return; }
      var btn = document.getElementById("v18-submit");
      btn.disabled = true;
      btn.textContent = "Sending securely…";
      try {
        var ts = Date.now();
        var idBlob = (await toJpeg(idFile, 1600)) || idFile;
        var sfBlob = (await toJpeg(selfieFile, 1600)) || selfieFile;
        var idPath = u.id + "/id-" + ts + ".jpg";
        var sfPath = u.id + "/selfie-" + ts + ".jpg";
        var up1 = await sb.storage.from("id-docs").upload(idPath, idBlob, { contentType: "image/jpeg", upsert: false });
        if (up1.error) throw up1.error;
        var up2 = await sb.storage.from("id-docs").upload(sfPath, sfBlob, { contentType: "image/jpeg", upsert: false });
        if (up2.error) throw up2.error;
        var ins = await sb.from("id_verifications").insert({ user_id: u.id, id_image_path: idPath, selfie_path: sfPath });
        if (ins.error) throw ins.error;
        note('<p>⏳ <b>Submitted — under review.</b></p><p class="muted">The owner checks your ID against your selfie by hand. Your 🔞 18+ Verified badge lands on your page as soon as you\'re approved.</p>');
      } catch (e) {
        err.textContent = "That didn't go through — try again. (" + (e.message || e) + ")";
        btn.disabled = false;
        btn.textContent = "Submit for review";
      }
    });
  })();
})();
