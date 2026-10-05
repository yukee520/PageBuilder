#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "src", "services", "runtimeSource.ts");
const text = fs.readFileSync(SOURCE, "utf8");
const entries = [];
const re = /path:\s*"([^"]+)"[\s\S]*?base64:\s*.([A-Za-z0-9+/=]+)./g;
let m;
while ((m = re.exec(text)) !== null) {
  entries.push({ path: m[1], base64: m[2] });
}
if (entries.length === 0) {
  console.log("ERROR: could not parse runtimeSource.ts");
  process.exit(1);
}
console.log("Embedded files:", entries.length);
const musicEntry = entries.find(e => e.path === "runtime/src/MusicPlayer.tsx");
if (!musicEntry) {
  console.log("ERROR: MusicPlayer.tsx not found");
  process.exit(1);
}
const decoded = Buffer.from(musicEntry.base64, "base64").toString("utf8");
console.log("MusicPlayer.tsx length:", decoded.length);
console.log("  has react-native-video:", decoded.includes("react-native-video"));
console.log("  has react-native-sound:", decoded.includes("react-native-sound"));
console.log("  first line:", decoded.split("\n")[0]);
const comp = entries.find(e => e.path === "src/types/component.ts");
if (comp) {
  const c = Buffer.from(comp.base64, "base64").toString("utf8");
  console.log("component.ts has accessToken:", c.includes("accessToken"));
}
