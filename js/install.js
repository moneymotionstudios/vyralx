// VIRALX — Download / Install the app (PWA).
// Self-injecting: a floating "Download App" button on every page, the real
// Android install prompt when the browser offers it, and step-by-step help
// for iPhone / other browsers. Hidden when already installed.
(function () {
  var isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isStandalone) { window.VXInstall = function () {}; return; }

  var deferred = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    showBtn();
  });
  window.addEventListener("appinstalled", function () {
    hideBtn();
    toast("VIRALX is installed ✅ Check your home screen.");
  });

  var btn = null;
  function showBtn() {
    if (btn || isStandalone) return;
    btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "⬇️ Download App";
    btn.setAttribute("style", "position:fixed;right:14px;bottom:78px;z-index:999;background:#8BFF00;color:#090B0A;border:none;border-radius:999px;padding:12px 18px;font-weight:900;font-size:15px;box-shadow:0 6px 22px rgba(139,255,0,.35);cursor:pointer;");
    btn.addEventListener("click", window.VXInstall);
    document.body.appendChild(btn);
  }
  function hideBtn() { if (btn) { btn.remove(); btn = null; } }

  function toast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.setAttribute("style", "position:fixed;left:50%;transform:translateX(-50%);bottom:140px;z-index:1000;background:#101312;border:1px solid #8BFF00;color:#E8F5E9;border-radius:12px;padding:10px 16px;font-size:14px;max-width:86vw;text-align:center;");
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
  }

  function help() {
    var ua = navigator.userAgent || "";
    var isIOS = /iphone|ipad|ipod/i.test(ua);
    var steps = isIOS
      ? "<b>On iPhone (Safari):</b><br>1. Tap the <b>Share</b> button (square with an arrow)<br>2. Scroll down, tap <b>Add to Home Screen</b><br>3. Tap <b>Add</b> — VIRALX lands on your home screen like an app."
      : "<b>On Android (Chrome):</b><br>1. Tap the <b>⋮ menu</b> (top right)<br>2. Tap <b>Install app</b> or <b>Add to Home screen</b><br>3. Tap <b>Install</b> — VIRALX lands on your home screen like an app.";
    var m = document.createElement("div");
    m.setAttribute("style", "position:fixed;inset:0;z-index:1001;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px;");
    m.innerHTML = '<div style="background:#101312;border:1px solid #232826;border-radius:16px;padding:20px;max-width:420px;width:100%;color:#E8F5E9;line-height:1.55;">' +
      '<h3 style="margin:0 0 10px;">⬇️ Get the VIRALX app</h3><p style="margin:0 0 12px;">' + steps + '</p>' +
      '<button type="button" style="background:#8BFF00;color:#090B0A;border:none;border-radius:10px;padding:10px 16px;font-weight:800;width:100%;cursor:pointer;">Got it</button></div>';
    m.addEventListener("click", function (e) { if (e.target === m || e.target.tagName === "BUTTON") m.remove(); });
    document.body.appendChild(m);
  }

  window.VXInstall = async function () {
    if (deferred) {
      try {
        deferred.prompt();
        var choice = await deferred.userChoice;
        if (choice && choice.outcome === "accepted") hideBtn();
        deferred = null;
      } catch (e) { help(); }
    } else {
      help();
    }
  };

  // Show the button right away on iOS (no install prompt exists there) and
  // after a short beat elsewhere, in case the prompt event is slow.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent || "")) {
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", showBtn) : showBtn();
  } else {
    setTimeout(showBtn, 2500);
  }
})();
