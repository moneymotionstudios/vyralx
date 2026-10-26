// VYRALX configuration.
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
  STREAM_HOST: ""
};
