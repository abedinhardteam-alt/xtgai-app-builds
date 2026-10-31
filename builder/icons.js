// Launcher/splash glyphs drawn as simple stroke paths on a 108x108 adaptive-icon canvas (safe zone 30..78). Original artwork.
const ICONS = {
  calculator: ["M38,30 h32 a4,4 0 0 1 4,4 v40 a4,4 0 0 1 -4,4 h-32 a4,4 0 0 1 -4,-4 v-40 a4,4 0 0 1 4,-4 z", "M40,36 h28 v10 h-28 z",
    "M42,54 h4 M52,54 h4 M62,54 h4 M42,62 h4 M52,62 h4 M62,62 h4 M42,70 h4 M52,70 h4 M62,70 h4"],
  todo: ["M34,36 h8 v8 h-8 z", "M34,52 h8 v8 h-8 z", "M34,68 h8 v8 h-8 z", "M50,40 h24 M50,56 h24 M50,72 h18", "M35,56 l3,3 l6,-7"],
  quiz: ["M44,44 a10,10 0 1 1 14,9 c-3,1.5 -4,3.5 -4,7 v3", "M54,72 v1.5", "M54,26 a28,28 0 1 1 -0.1,0 z"],
  note: ["M38,30 h24 l10,10 v38 h-34 z", "M62,30 v10 h10", "M44,50 h22 M44,58 h22 M44,66 h14"],
  game: ["M40,42 h28 a12,12 0 0 1 0,24 h-4 l-4,-4 h-12 l-4,4 h-4 a12,12 0 0 1 0,-24 z", "M40,54 h8 M44,50 v8", "M64,51 v0.5 M68,56 v0.5"],
  star: ["M54,30 l7,15 l16,2 l-12,11 l3,16 l-14,-8 l-14,8 l3,-16 l-12,-11 l16,-2 z"],
  heart: ["M54,74 l-17,-17 a10,10 0 0 1 17,-14 a10,10 0 0 1 17,14 z"],
  timer: ["M54,36 a20,20 0 1 1 -0.1,0 z", "M54,46 v10 l7,5", "M48,30 h12"],
  book: ["M54,38 c-6,-4 -14,-5 -20,-4 v38 c6,-1 14,0 20,4 c6,-4 14,-5 20,-4 v-38 c-6,-1 -14,0 -20,4 z", "M54,38 v38"],
  money: ["M32,40 h44 v28 h-44 z", "M54,46 a8,8 0 1 1 -0.1,0 z", "M38,46 v0.5 M70,62 v0.5"],
  music: ["M46,70 a6,6 0 1 1 -0.1,0 z", "M52,70 v-36 l18,-4 v30", "M64,60 a6,6 0 1 1 -0.1,0 z"],
  shop: ["M36,44 h36 l-3,32 h-30 z", "M46,48 v-6 a8,8 0 0 1 16,0 v6"],
  bolt: ["M58,28 l-18,30 h14 l-4,22 l18,-30 h-14 z"],
  globe: ["M54,32 a22,22 0 1 1 -0.1,0 z", "M32,54 h44", "M54,32 c-10,12 -10,32 0,44 c10,-12 10,-32 0,-44"],
};
const KEYS = Object.keys(ICONS);
function vector(key, sizeDp) {
  const paths = ICONS[key] || ICONS.bolt;
  const body = paths.map((d) => `  <path android:pathData="${d}" android:strokeColor="#FFFFFFFF" android:strokeWidth="4" android:strokeLineCap="round" android:strokeLineJoin="round" android:fillColor="#00000000" />`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="${sizeDp || 108}dp" android:height="${sizeDp || 108}dp" android:viewportWidth="108" android:viewportHeight="108">\n${body}\n</vector>\n`;
}
module.exports = { ICONS, KEYS, vector };
