// VIRALX sparkle FX — floating sparkle field + tap bursts. Pure flair:
// pointer-events none, cheap transforms, honors reduced-motion.
(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var EMOJI = ["✨", "⭐", "💫", "🌟", "⚡"];
  var layer = document.createElement("div");
  layer.id = "fx-layer";
  document.body.appendChild(layer);

  var N = window.innerWidth < 480 ? 9 : 13;
  for (var i = 0; i < N; i++) {
    var s = document.createElement("span");
    s.className = "fx-sparkle";
    s.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
    s.style.left = (Math.random() * 96) + "vw";
    s.style.fontSize = (11 + Math.random() * 13) + "px";
    s.style.opacity = String(0.35 + Math.random() * 0.4);
    var dur = 9 + Math.random() * 9;
    s.style.animationDuration = dur + "s";
    s.style.animationDelay = (-Math.random() * dur) + "s";
    layer.appendChild(s);
  }

  // Small sparkle burst wherever a button/tab is tapped.
  var last = 0;
  document.addEventListener("pointerdown", function (e) {
    var t = e.target && e.target.closest ? e.target.closest(".btn, .menu-item, .bottomnav a, .rail button, .feed-tabs button, .golive-btn") : null;
    if (!t) return;
    var now = Date.now();
    if (now - last < 120) return;
    last = now;
    for (var j = 0; j < 5; j++) {
      var b = document.createElement("span");
      b.className = "fx-burst";
      b.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
      b.style.left = e.clientX + "px";
      b.style.top = e.clientY + "px";
      var ang = Math.random() * Math.PI * 2, dist = 26 + Math.random() * 42;
      b.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      b.style.setProperty("--dy", (Math.sin(ang) * dist - 14) + "px");
      document.body.appendChild(b);
      (function (el) { setTimeout(function () { el.remove(); }, 720); })(b);
    }
  }, { passive: true });
})();
