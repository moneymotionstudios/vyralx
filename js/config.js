// VIRALX configuration.
// Its own Supabase project ("vyralx") — separate from the studio apps.
// While the keys are empty the app runs in DEMO MODE with seed content.
window.VX_CONFIG = {
  SUPABASE_URL: "https://ubwbtzcqdpesayotqwsm.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_cP_9aTsY_fwl7bBD5iNAyg_zV7R_uVd",
  // Live streaming host (the SRS + chat stack in ~/workspace/vyralx/streaming).
  // Set to the streaming server's hostname/IP (no scheme) and LIVE turns on:
  //   HLS  http://<host>:8080/live/<stream>.m3u8   (+ _720p / _480p tiers)
  //   Chat ws://<host>:8081   Ingest rtmp://<host>:1935/live
  // Empty = streaming host not connected yet.
  STREAM_HOST: "",
  // Livepeer (free tier) — the house channel, live now. Playback is public;
  // the stream key is NOT stored here (it lives in the owner's streaming app).
  LIVEPEER_HLS: "https://livepeercdn.studio/hls/f8d6m0g1wx9nbj5t/index.m3u8",
  LIVEPEER_WHEP: "https://livepeercdn.studio/webrtc/f8d6m0g1wx9nbj5t",
  LIVEPEER_RTMP: "rtmp://rtmp.livepeer.com/live",
  // LiveKit (creator rooms — golive.html / watch.html). Public wss URL of
  // the LiveKit project; the API key/secret live ONLY as Supabase secrets
  // (LIVEKIT_API_KEY / LIVEKIT_API_SECRET) used by the lk-token function.
  // Empty = LIVE engine not linked yet (pages say so honestly).
  LIVEKIT_URL: ""
};
