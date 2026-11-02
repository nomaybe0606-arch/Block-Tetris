// Renders catalogue artwork with headless Chrome. Usage: node scripts/create-promo.mjs <vk|pikabu> → promo/<target>/
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const target = process.argv[2];
if (!['vk', 'pikabu'].includes(target)) throw new Error('Usage: node scripts/create-promo.mjs <vk|pikabu>');
const out = join(root, 'promo', target);
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// Pikabu Games forbids foreign words in titles, so its artwork uses the Russian name.
const title = target === 'pikabu' ? 'Грид Пульс' : 'Grid Pulse';
const slogan = 'Собирай линии в своём ритме';
// Same palette as the game (src/config/layout.ts).
const COLORS = ['#9274ff', '#32caff', '#ffbe55', '#f06bb4', '#32dcc3', '#4f91ff', '#cd71fa'];

const icon = readFileSync(join(root, 'public/favicon.svg'), 'utf8');
const iconUri = (rounded = true) => `data:image/svg+xml;base64,${Buffer.from(rounded ? icon : icon.replace('rx="16"', 'rx="0"')).toString('base64')}`;

const base = `*{box-sizing:border-box;margin:0}
html,body{width:100%;height:100%;overflow:hidden}
body{font-family:"Trebuchet MS",Arial,sans-serif;color:#f0f0ff;position:relative;
  background:radial-gradient(ellipse at 8% 8%,#6d409d55,transparent 50%),radial-gradient(ellipse at 92% 78%,#087b8960,transparent 52%),linear-gradient(155deg,#151735,#101a34 65%,#172b42)}
body::before{content:"";position:absolute;inset:0;opacity:.12;background-image:radial-gradient(#9da8db 1px,transparent 1.2px);background-size:26px 26px}
h1{font-weight:800;line-height:1.05;letter-spacing:-1.5px;text-shadow:0 6px 24px #05081f80}
p{color:#b9c2e0;font-weight:600}
.brand{letter-spacing:4px;font-size:26px;color:#d9dcff}.brand b{font-weight:800}
.chip{display:inline-block;padding:10px 20px;border-radius:999px;background:#ffffff14;border:1px solid #a8b8ff36;font-weight:700;font-size:22px;margin:8px 10px 0 0;color:#dfe4ff}
.board{position:absolute;display:grid;padding:14px;border-radius:26px;background:linear-gradient(145deg,#232a52ee,#141b3aee);border:1px solid #a7b5ff40;box-shadow:0 30px 70px #02051a90,0 0 50px #8064e722}
.cell{border-radius:9px;background:#0d1330;box-shadow:inset 0 1px 2px #00000080}
.block{border-radius:9px;position:relative;box-shadow:inset 0 2px 1px #ffffffc0,inset 0 -5px 5px #11163450,0 0 16px var(--c)}
.block::after{content:"";position:absolute;inset:20% 18% 26%;border-radius:4px;border:1px solid #ffffff30}
.glow{animation:none;box-shadow:inset 0 2px 1px #ffffffe0,0 0 26px #fff,0 0 40px var(--c)}`;

const blockStyle = color => `--c:${color}80;background:linear-gradient(155deg,${color}ee,${color} 45%,${color}99)`;
// A board as rows of characters: '.' is empty, digits pick a colour, '*' marks a line that is clearing.
function board(rows, cell, gap, style) {
  if(rows.length!==8||rows.some(row=>row.length!==8))throw new Error('Catalogue artwork must use an 8×8 board');
  const html = rows.flatMap(row => [...row].map(ch => {
    if (ch === '.') return '<i class="cell"></i>';
    if (ch === '*') return `<i class="block glow" style="${blockStyle('#ffffff')}"></i>`;
    return `<i class="block" style="${blockStyle(COLORS[Number(ch)])}"></i>`;
  })).join('');
  return `<div class="board" style="grid-template-columns:repeat(${rows[0].length},${cell}px);grid-auto-rows:${cell}px;gap:${gap}px;${style}">${html}</div>`;
}
const headline = (heading, body, width = 520, size = 60) => `<div style="position:absolute;left:72px;top:50%;transform:translateY(-50%);width:${width}px">
  <h1 style="font-size:${size}px">${heading}</h1><div style="margin-top:26px;font-size:28px">${body}</div></div>`;

const midGame = ['00..1144', '0...1.44', '22.5555.', '2...6...', '********', '33.6..00', '3..66.0.', '3...2220'];
const comboBoard = ['1100*344', '1...*...', '22..*.55', '2...*..5', '6...*...', '66..*.00', '.6..*..0', '33..*220'];
const calmBoard = ['........', '..00....', '..0..11.', '......1.', '.33.....', '.3...44.', '.......4', '22......'];

const iconPage = `<img src="${iconUri(false)}" style="position:absolute;inset:0;width:100%;height:100%">`;
// Each page is [layout width, layout height, markup, output scale]; the PNG is layout × scale.
const VK = {
  'icon-576.png': [576, 576, `<img src="${iconUri(false)}" style="position:absolute;inset:0;width:100%;height:100%">`],
  'icon-278.png': [278, 278, `<img src="${iconUri(false)}" style="position:absolute;inset:0;width:100%;height:100%">`],
  'icon-150.png': [150, 150, `<img src="${iconUri(false)}" style="position:absolute;inset:0;width:100%;height:100%">`],
  'favicon-32.png': [32, 32, `<img src="${iconUri(false)}" style="position:absolute;inset:0;width:100%;height:100%">`],
  'snippet-1120x630.png': [1120, 630, `
    <img src="${iconUri()}" style="position:absolute;left:72px;top:70px;width:110px;height:110px;filter:drop-shadow(0 12px 24px #05081f90)">
    <h1 style="position:absolute;left:72px;top:230px;font-size:92px;width:560px">${title}</h1>
    <p style="position:absolute;left:76px;top:420px;font-size:34px;width:540px">${slogan}</p>
    ${board(midGame, 46, 7, 'left:620px;top:80px;transform:rotate(4deg)')}`],
  'screenshot-1-1200x600.png': [1200, 600, `
    ${headline('Заполняй ряды и столбцы', '<p>Перетаскивай фигуры на поле 8 × 8 — полная линия исчезает</p>')}
    ${board(midGame, 50, 7, 'left:660px;top:46px')}`],
  'screenshot-2-1200x600.png': [1200, 600, `
    ${headline('Комбо за несколько линий подряд', '<span class="chip">✨ Яркие эффекты</span><span class="chip">🏆 Личный рекорд</span>')}
    ${board(comboBoard, 50, 7, 'left:660px;top:46px')}`],
  'screenshot-3-1200x600.png': [1200, 600, `
    ${headline('Без таймера.<br>В своём ритме', '<span class="chip">🔄 Замена фигуры</span><span class="chip">🎵 Спокойная музыка</span><span class="chip">💾 Прогресс сохраняется</span>', 540)}
    ${board(calmBoard, 50, 7, 'left:660px;top:46px')}`],
};
// Pikabu Games wants a 1024 square icon and 16:9 art from 1920×1080; it is laid out at 1280×720 and rendered at 1.5×.
const wide = (heading, body, rows, width = 500) => `${headline(heading, body, width, 64)}${board(rows, 64, 8, 'left:612px;top:62px')}`;
const PIKABU = {
  'icon-1024.png': [576, 576, iconPage, 1024 / 576],
  'cover-1920x1080.png': [1280, 720, `
    <img src="${iconUri()}" style="position:absolute;left:80px;top:90px;width:120px;height:120px;filter:drop-shadow(0 12px 24px #05081f90)">
    <h1 style="position:absolute;left:80px;top:276px;font-size:84px;width:600px">${title}</h1>
    <p style="position:absolute;left:84px;top:470px;font-size:36px;width:430px">${slogan}</p>
    ${board(midGame, 60, 8, 'left:665px;top:84px;transform:rotate(4deg)')}`, 1.5],
  'screenshot-1-1920x1080.png': [1280, 720, wide('Заполняй ряды и столбцы', '<p>Перетаскивай фигуры на поле 8 × 8 — полная линия исчезает</p>', midGame), 1.5],
  'screenshot-2-1920x1080.png': [1280, 720, wide('Комбо за несколько линий подряд', '<span class="chip">✨ Яркие эффекты</span><span class="chip">🏆 Личный рекорд</span>', comboBoard), 1.5],
  'screenshot-3-1920x1080.png': [1280, 720, wide('Без таймера.<br>В своём ритме', '<span class="chip">🔄 Замена фигуры</span><span class="chip">🎵 Спокойная музыка</span><span class="chip">💾 Прогресс сохраняется</span>', calmBoard), 1.5],
};
const pages = target === 'vk' ? VK : PIKABU;

mkdirSync(out, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'vk-promo-'));
try {
  for (const [file, [width, height, body, fixedScale]] of Object.entries(pages)) {
    // Headless Chrome has a minimum window size, so small icons are drawn at 576 px and scaled down.
    const scale = fixedScale ?? (width < 576 && width === height ? width / 576 : 1);
    // Downscaling uses the device scale factor; upscaling uses CSS zoom, since headless Chrome clamps large scaled windows.
    const zoom = scale > 1 ? scale : 1, dsf = scale > 1 ? 1 : scale;
    const html = join(work, file.replace(/\.png$/, '.html'));
    writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${base}</style><body><div style="position:relative;width:${width / dsf}px;height:${height / dsf}px;zoom:${zoom}">${body}</div></body>`);
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${dsf}`, '--virtual-time-budget=2000',
      `--window-size=${Math.round(width * zoom / dsf)},${Math.round(height * zoom / dsf)}`, `--screenshot=${join(out, file)}`, pathToFileURL(html).href], { stdio: 'ignore' });
    console.log(`promo/${target}/${file}`);
  }
} finally { rmSync(work, { recursive: true, force: true }); }
