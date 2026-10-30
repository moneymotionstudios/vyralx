// VIRALX built-in sound library — original loops generated for VIRALX (free to use in-app).
// Audio ships embedded in js/sounds-audio.js (data URIs); fall back to the file path.
window.VX_soundSrc = function (s) {
  return (window.VX_SOUND_AUDIO && window.VX_SOUND_AUDIO[s.id]) || s.file;
};
window.VX_SOUNDS = [
  { id: "lib:trap-night-142", name: "Trap Night — 142 BPM (D minor)", genre: "Trap", file: "assets/sounds/trap-night-142.mp3" },
  { id: "lib:rnb-silk-92", name: "R&B Silk — 92 BPM", genre: "R&B", file: "assets/sounds/rnb-silk-92.mp3" },
  { id: "lib:drill-slide-140", name: "Drill Slide — 140 BPM", genre: "Drill", file: "assets/sounds/drill-slide-140.mp3" },
  { id: "lib:lofi-dust-80", name: "LoFi Dust — 80 BPM", genre: "LoFi", file: "assets/sounds/lofi-dust-80.mp3" },
  { id: "lib:house-party-124", name: "House Party — 124 BPM", genre: "House", file: "assets/sounds/house-party-124.mp3" },
  { id: "lib:afro-wave-105", name: "Afro Wave — 105 BPM", genre: "Afrobeats", file: "assets/sounds/afro-wave-105.mp3" }
];
