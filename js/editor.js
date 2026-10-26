// VIRALX Creator Studio — in-browser editing with FFmpeg.wasm:
// AutoCut (silence removal), trim, filters, 9:16 crop, speed, text overlay
// (rendered via canvas so no font files are needed), export + post to feed.
import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

const $ = (id) => document.getElementById(id);
const sb = window.VX && window.VX.sb;
let ffmpeg = null, loaded = false, srcFile = null, srcName = "in.mp4";
let duration = 0, outBlob = null, cutSegments = null;

async function loadFFmpeg(statusEl) {
  if (loaded) return;
  statusEl.textContent = "Loading the editor engine (one-time, ~30 MB)…";
  ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    const el = $("export-status");
    if (el && document.activeElement !== el) el.dataset.p = Math.round(progress * 100) + "%";
  });
  const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(base + "/ffmpeg-core.js", "text/javascript"),
    wasmURL: await toBlobURL(base + "/ffmpeg-core.wasm", "application/wasm"),
  });
  loaded = true;
  statusEl.textContent = "Editor engine ready ✅";
}

$("file").addEventListener("change", () => {
  srcFile = $("file").files[0] || null;
  cutSegments = null;
  $("autocut-status").textContent = "";
  if (!srcFile) return;
  srcName = "in." + ((srcFile.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4");
  const v = $("preview");
  v.src = URL.createObjectURL(srcFile);
  v.onloadedmetadata = () => {
    duration = v.duration || 0;
    $("meta").textContent = "Length: " + duration.toFixed(1) + "s · " + v.videoWidth + "×" + v.videoHeight + " · " + (srcFile.size / 1048576).toFixed(1) + " MB";
    $("tend").value = "0";
  };
});

// ---------- AutoCut: silencedetect -> keep segments ----------
$("autocut").addEventListener("click", async () => {
  const st = $("autocut-status");
  if (!srcFile) { st.textContent = "Pick a video first."; return; }
  try {
    await loadFFmpeg(st);
    st.textContent = "Listening for silences…";
    await ffmpeg.writeFile(srcName, await fetchFile(srcFile));
    let logText = "";
    const onLog = ({ message }) => { logText += message + "\n"; };
    ffmpeg.on("log", onLog);
    await ffmpeg.exec(["-i", srcName, "-af", "silencedetect=noise=-35dB:d=0.6", "-f", "null", "-"]);
    ffmpeg.off("log", onLog);
    const starts = [...logText.matchAll(/silence_start: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
    const ends = [...logText.matchAll(/silence_end: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
    const silences = [];
    for (let i = 0; i < starts.length; i++) silences.push([starts[i], ends[i] !== undefined ? ends[i] : duration]);
    if (!silences.length) { st.textContent = "No dead air found — your pacing is already tight 🔥"; cutSegments = null; return; }
    // keep = everything except silences (with 0.08s padding kept around cuts)
    const keep = [];
    let cur = 0;
    for (const [s, e] of silences) {
      const ks = Math.max(cur, s - 0.05), ke = e + 0.05;
      if (ks > cur + 0.15) keep.push([cur, ks]);
      cur = Math.max(cur, ke);
    }
    if (cur < duration - 0.15) keep.push([cur, duration]);
    cutSegments = keep.slice(0, 60);
    const keptSecs = keep.reduce((a, [s, e]) => a + (e - s), 0);
    st.textContent = "AutoCut found " + silences.length + " silences → removes " + (duration - keptSecs).toFixed(1) + "s of dead air (" + keep.length + " cuts). Hit Export to apply.";
  } catch (ex) {
    st.textContent = "AutoCut hit a snag: " + (ex.message || ex);
  }
});

// ---------- text overlay PNG via canvas ----------
function textPng(text, videoW, videoH, pos) {
  const c = document.createElement("canvas");
  c.width = videoW; c.height = videoH;
  const x = c.getContext("2d");
  const fs = Math.max(28, Math.round(videoW / 14));
  x.font = "900 " + fs + "px Arial, sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  const lines = [];
  const words = text.split(/\s+/);
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (x.measureText(t).width > videoW * 0.86 && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  const lh = fs * 1.25, blockH = lh * lines.length;
  let y0 = pos === "top" ? videoH * 0.08 : pos === "middle" ? (videoH - blockH) / 2 : videoH * 0.92 - blockH;
  x.fillStyle = "rgba(0,0,0,0.45)";
  x.fillRect(0, y0 - lh * 0.35, videoW, blockH + lh * 0.7);
  x.lineWidth = fs / 8; x.strokeStyle = "#090B0A"; x.fillStyle = "#8BFF00";
  lines.forEach((ln, i) => {
    const y = y0 + lh * (i + 0.5);
    x.strokeText(ln, videoW / 2, y); x.fillText(ln, videoW / 2, y);
  });
  return new Promise((res) => c.toBlob(res, "image/png"));
}

const FILTERS = {
  toxic: "eq=saturation=1.5:contrast=1.1,colorbalance=gs=0.25:gm=0.1",
  cinematic: "eq=contrast=1.15:saturation=0.85:brightness=-0.02,curves=preset=increase_contrast",
  vivid: "eq=saturation=1.7:contrast=1.08",
  bw: "hue=s=0,eq=contrast=1.1",
  vintage: "colorbalance=rs=0.2:gs=0.08:bs=-0.15,eq=saturation=0.7:contrast=1.05",
};

// ---------- export ----------
$("export").addEventListener("click", async () => {
  const st = $("export-status");
  if (!srcFile) { st.textContent = "Pick a video first."; return; }
  const btn = $("export"); btn.disabled = true;
  try {
    await loadFFmpeg(st);
    if (!(await ffmpeg.listDir("/")).some((f) => f.name === srcName)) {
      await ffmpeg.writeFile(srcName, await fetchFile(srcFile));
    }
    let cur = srcName;
    // Pass A: AutoCut segments
    if (cutSegments && cutSegments.length) {
      st.textContent = "AutoCut: stitching " + cutSegments.length + " segments…";
      const parts = [];
      const fc = [];
      cutSegments.forEach(([s, e], i) => {
        fc.push(`[0:v]trim=start=${s.toFixed(2)}:end=${e.toFixed(2)},setpts=PTS-STARTPTS[v${i}]`);
        fc.push(`[0:a]atrim=start=${s.toFixed(2)}:end=${e.toFixed(2)},asetpts=PTS-STARTPTS[a${i}]`);
        parts.push(`[v${i}][a${i}]`);
      });
      fc.push(parts.join("") + `concat=n=${cutSegments.length}:v=1:a=1[v][a]`);
      await ffmpeg.exec(["-i", cur, "-filter_complex", fc.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "cut.mp4"]);
      cur = "cut.mp4";
    }
    // Pass B: trim / crop / filter / speed / text
    st.textContent = "Exporting your cut…";
    const ss = parseFloat($("tstart").value || "0");
    const to = parseFloat($("tend").value || "0");
    const speed = parseFloat($("speed").value || "1");
    const vf = [];
    if ($("crop916").checked) vf.push("crop=ih*9/16:ih:(iw-ih*9/16)/2:0");
    if ($("filter").value && FILTERS[$("filter").value]) vf.push(FILTERS[$("filter").value]);
    if (speed !== 1) vf.push(`setpts=${(1 / speed).toFixed(3)}*PTS`);
    vf.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
    const args = ["-i", cur];
    const text = $("text").value.trim();
    let filterComplex = "";
    const vlabel = "[v]";
    if (text) {
      const vmeta = $("preview");
      const png = await textPng(text, vmeta.videoWidth || 720, vmeta.videoHeight || 1280, $("textpos").value);
      await ffmpeg.writeFile("text.png", await fetchFile(png));
      args.push("-i", "text.png");
      filterComplex = `[0:v]${vf.join(",")}[vb];[vb][1:v]overlay=0:0${vlabel}`;
    } else {
      filterComplex = `[0:v]${vf.join(",")}${vlabel}`;
    }
    let aFilter = "";
    if (speed !== 1) aFilter = `atempo=${speed}`;
    const fullArgs = [...args];
    if (ss > 0) fullArgs.push("-ss", String(ss));
    if (to > 0) fullArgs.push("-to", String(to));
    fullArgs.push("-filter_complex", filterComplex, "-map", vlabel);
    if (aFilter) fullArgs.push("-af", aFilter);
    fullArgs.push("-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", "out.mp4");
    const code = await ffmpeg.exec(fullArgs);
    if (code !== 0) throw new Error("FFmpeg export failed (code " + code + ") — try fewer effects or a shorter clip.");
    const data = await ffmpeg.readFile("out.mp4");
    outBlob = new Blob([data.buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(outBlob);
    $("out").src = url;
    $("out-wrap").classList.remove("hidden");
    $("out-actions").classList.remove("hidden");
    $("download").href = url;
    st.textContent = "Export done ✅ " + (outBlob.size / 1048576).toFixed(1) + " MB";
  } catch (ex) {
    st.textContent = "Export hit a snag: " + (ex.message || ex);
  } finally { btn.disabled = false; }
});

$("post").addEventListener("click", async () => {
  const st = $("post-status");
  if (!outBlob) { st.textContent = "Export first."; return; }
  if (!sb) { st.textContent = "Posting needs the VIRALX backend."; return; }
  const u = (await sb.auth.getUser()).data.user;
  if (!u) { location.href = "auth.html"; return; }
  if (outBlob.size > 50 * 1024 * 1024) { st.textContent = "Over the 50 MB free limit — trim it shorter."; return; }
  st.textContent = "Posting…";
  try {
    const path = u.id + "/" + Date.now() + "-edit.mp4";
    const file = new File([outBlob], "viralx-edit.mp4", { type: "video/mp4" });
    const up = await sb.storage.from("videos").upload(path, file, { contentType: "video/mp4" });
    if (up.error) throw up.error;
    const pub = sb.storage.from("videos").getPublicUrl(path).data.publicUrl;
    const ins = await sb.from("videos").insert({
      user_id: u.id, caption: $("text").value.trim() || "Edited in VIRALX Creator Studio",
      hashtags: ["#viralx", "#edited"], category: "entertainment", video_url: pub, storage_path: path,
    });
    if (ins.error) throw ins.error;
    st.textContent = "Posted to the feed ✅";
  } catch (ex) { st.textContent = ex.message || String(ex); }
});
