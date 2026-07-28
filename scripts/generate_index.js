#!/usr/bin/env node
import { readdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DOCS = resolve(ROOT, "docs");

const files = readdirSync(DOCS)
  .filter((f) => f.startsWith("zombie-vape-") && f.endsWith(".html"))
  .sort()
  .reverse();

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

let links = "";
for (const name of files.slice(0, 30)) {
  const date = name.replace("zombie-vape-", "").replace(".html", "");
  const parts = date.split("-");
  let dateDisplay = date;
  let weekday = "";
  if (parts.length === 3) {
    const d = new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2])
    );
    if (!isNaN(d.getTime())) {
      dateDisplay = `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
      weekday = `週${WEEKDAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]}`;
    }
  }
  links += `<li><a href="${name}">\uD83D\uDCC5 ${dateDisplay}（${weekday}）</a></li>\n`;
}

const total = files.length;

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Zombie Vape Digest &middot; Etomidate 電子煙研究文獻日報</title>
<style>
  :root { --bg: #f6f1e8; --surface: #fffaf2; --line: #d8c5ab; --text: #2b2118; --muted: #766453; --accent: #8c4f2b; --accent-soft: #ead2bf; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: radial-gradient(circle at top, #fff6ea 0, var(--bg) 55%, #ead8c6 100%); color: var(--text); font-family: "Noto Sans TC", "PingFang TC", "Helvetica Neue", Arial, sans-serif; min-height: 100vh; }
  .container { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; padding: 80px 24px; }
  .logo { font-size: 48px; text-align: center; margin-bottom: 16px; }
  h1 { text-align: center; font-size: 24px; color: var(--text); margin-bottom: 8px; }
  .subtitle { text-align: center; color: var(--accent); font-size: 14px; margin-bottom: 48px; }
  .count { text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 32px; }
  ul { list-style: none; }
  li { margin-bottom: 8px; }
  a { color: var(--text); text-decoration: none; display: block; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; transition: all 0.2s; font-size: 15px; }
  a:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  .links-grid { margin-top: 32px; display: flex; flex-direction: column; gap: 8px; }
  .link-card { display: flex; align-items: center; gap: 14px; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; text-decoration: none; color: var(--text); transition: all 0.2s; font-size: 14px; }
  .link-card:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  .link-icon { font-size: 22px; flex-shrink: 0; }
  .link-name { font-weight: 600; flex: 1; }
  footer { margin-top: 56px; text-align: center; font-size: 12px; color: var(--muted); }
  footer a { display: inline; padding: 0; background: none; border: none; color: var(--muted); }
  footer a:hover { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <div class="logo">\u2620\uFE0F</div>
  <h1>Zombie Vape Digest</h1>
  <p class="subtitle">Etomidate 電子煙研究文獻日報 &middot; 每日自動更新</p>
  <p class="count">共 ${total} 期日報</p>
  <ul>${links}</ul>
  <div class="links-grid">
    <a href="https://www.leepsyclinic.com/" class="link-card" target="_blank">
      <span class="link-icon">\uD83C\uDFE5</span>
      <span class="link-name">李政洋身心診所首頁</span>
    </a>
    <a href="https://blog.leepsyclinic.com/" class="link-card" target="_blank">
      <span class="link-icon">\uD83D\uDCF0</span>
      <span class="link-name">訂閱電子報</span>
    </a>
    <a href="https://buymeacoffee.com/CYlee" class="link-card" target="_blank">
      <span class="link-icon">\u2615</span>
      <span class="link-name">Buy Me a Coffee</span>
    </a>
  </div>
  <footer>
    <p>Powered by PubMed + NVIDIA AI &middot; <a href="https://github.com/u8901006/zombie-vape">GitHub</a></p>
  </footer>
</div>
</body>
</html>`;

writeFileSync(resolve(DOCS, "index.html"), html, "utf-8");
console.error("[INFO] Index page generated");
