import { W, H, BUDGET, PRICES, COLORS as C } from './config.js';
import { angleDelta, clamp, rayEnd } from './vision.js';

export const LOADOUT_LAYOUT = {
  rows: [
    { tool: 'emp', x: 560, y: 212, w: 478, h: 84, minus: { x: 897, y: 237, w: 34, h: 34 }, plus: { x: 997, y: 237, w: 34, h: 34 } },
    { tool: 'decoy', x: 560, y: 296, w: 478, h: 84, minus: { x: 897, y: 321, w: 34, h: 34 }, plus: { x: 997, y: 321, w: 34, h: 34 } },
    { tool: 'smoke', x: 560, y: 380, w: 478, h: 84, minus: { x: 897, y: 405, w: 34, h: 34 }, plus: { x: 997, y: 405, w: 34, h: 34 } },
    { tool: 'lockpick', x: 560, y: 464, w: 478, h: 84, toggle: { x: 897, y: 486, w: 134, h: 36 } },
  ],
  start: { x: 560, y: 630, w: 478, h: 60 },
};

export const UI_LAYOUT = {
  title: { x: 74, y: 541, w: 324, h: 60 },
  mute: { x: 1054, y: 22, w: 32, h: 34 },
  pause: { x: 1096, y: 22, w: 32, h: 34 },
  resume: { x: 402, y: 478, w: 348, h: 58 },
  retry: { x: 396, y: 528, w: 360, h: 58 },
  again: { x: 72, y: 630, w: 364, h: 58 },
};

const BODY = 'Arial, sans-serif';
const DISPLAY = 'Georgia, "Times New Roman", serif';
const money = (n) => `$${Math.floor(n).toLocaleString('en-US')}`;
const clock = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const over = (S, r) => S.pointer && S.pointer.inside && S.pointer.x >= r.x && S.pointer.x <= r.x + r.w && S.pointer.y >= r.y && S.pointer.y <= r.y + r.h;

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(ctx, points, color, stroke = null, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (color) { ctx.fillStyle = color; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function text(ctx, value, x, y, size = 14, color = C.ink, align = 'left', face = BODY, weight = '400') {
  ctx.font = `${weight} ${size}px ${face}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(value), x, y);
}

function tracked(ctx, value, x, y, size, spacing, color = C.muted, align = 'left', face = BODY) {
  ctx.font = `400 ${size}px ${face}`;
  const letters = [...value];
  const width = letters.reduce((sum, letter) => sum + ctx.measureText(letter).width, 0) + Math.max(0, letters.length - 1) * spacing;
  let at = x - (align === 'center' ? width / 2 : align === 'right' ? width : 0);
  for (const letter of letters) {
    text(ctx, letter, at, y, size, color, 'left', face);
    at += ctx.measureText(letter).width + spacing;
  }
}

function border(ctx, r, color = C.quiet, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
}

function button(ctx, S, r, label, primary = false, disabled = false) {
  const hover = !disabled && over(S, r);
  const pressed = hover && S.pointer.down;
  const y = r.y + (pressed ? 2 : hover ? -2 : 0);
  rect(ctx, r.x, y, r.w, r.h, disabled ? C.panel : primary ? hover ? '#eed5a0' : C.gold : hover ? C.panelLight : C.panel);
  border(ctx, { ...r, y }, disabled ? '#34434d' : primary ? C.gold : hover ? C.gold : '#52616a');
  text(ctx, label, r.x + r.w / 2, y + r.h / 2 + 5, r.h > 44 ? 15 : 13, disabled ? C.quiet : primary ? C.background : C.ink, 'center', BODY, '600');
  if (primary && r.w > 220) {
    line(ctx, r.x + 13, y + 12, r.x + 26, y + 12, C.goldDark);
    line(ctx, r.x + 13, y + 12, r.x + 13, y + 25, C.goldDark);
    line(ctx, r.x + r.w - 13, y + r.h - 12, r.x + r.w - 26, y + r.h - 12, C.goldDark);
    line(ctx, r.x + r.w - 13, y + r.h - 12, r.x + r.w - 13, y + r.h - 25, C.goldDark);
  }
}

function diamond(ctx, x, y, size, large = false) {
  polygon(ctx, [[x - size, y - size * 0.28], [x - size * 0.52, y - size * 0.78], [x + size * 0.52, y - size * 0.78], [x + size, y - size * 0.28], [x, y + size]], C.cyanDark, C.cyan, large ? 2 : 1);
  polygon(ctx, [[x - size, y - size * 0.28], [x, y + size], [x - size * 0.34, y - size * 0.28]], '#6ac9cc');
  polygon(ctx, [[x - size * 0.34, y - size * 0.28], [x, y + size], [x + size * 0.34, y - size * 0.28]], '#b4fff1');
  polygon(ctx, [[x + size * 0.34, y - size * 0.28], [x, y + size], [x + size, y - size * 0.28]], '#41a6b1');
  polygon(ctx, [[x - size * 0.52, y - size * 0.78], [x - size * 0.34, y - size * 0.28], [x + size * 0.34, y - size * 0.28], [x + size * 0.52, y - size * 0.78]], C.cyan);
  line(ctx, x - size, y - size * 0.28, x + size, y - size * 0.28, '#d6fff1', large ? 2 : 1);
}

function sparkle(ctx, x, y, size, color = C.gold) {
  polygon(ctx, [[x, y - size], [x + size * 0.2, y - size * 0.2], [x + size, y], [x + size * 0.2, y + size * 0.2], [x, y + size], [x - size * 0.2, y + size * 0.2], [x - size, y], [x - size * 0.2, y - size * 0.2]], color);
}

function toolIcon(ctx, tool, x, y, color = C.gold, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.7;
  if (tool === 'emp') {
    polygon(ctx, [[-6, 5], [-6, -6], [6, -6], [6, 5]], null, color);
    line(ctx, 0, -6, 0, -12, color, 1.6);
    ellipse(ctx, 0, -13, 2, 2, color);
    line(ctx, -3, -1, 3, -1, color, 1.6);
    line(ctx, -11, -6, -14, -9, color);
    line(ctx, 11, -6, 14, -9, color);
  } else if (tool === 'decoy') {
    ellipse(ctx, 0, -1, 7, 7, color);
    ellipse(ctx, 0, -1, 3, 3, C.panel);
    line(ctx, -7, 7, 7, 7, color, 1.6);
    line(ctx, -11, -1, -14, -1, color);
    line(ctx, 11, -1, 14, -1, color);
  } else if (tool === 'smoke') {
    polygon(ctx, [[-6, 8], [-6, -4], [-3, -8], [4, -8], [7, -4], [7, 8]], null, color);
    line(ctx, -5, 2, 6, 2, color, 1.6);
    line(ctx, 1, -8, 1, -12, color, 1.6);
    line(ctx, 1, -12, 7, -12, color, 1.6);
  } else {
    line(ctx, -8, 9, 5, -8, color, 2);
    line(ctx, 5, -8, 10, -8, color, 2);
    line(ctx, -3, 10, -3, -7, color, 1.5);
    line(ctx, -3, -7, 1, -10, color, 1.5);
  }
  ctx.restore();
}

function cone(ctx, origin, color, walls, alpha = 0.13) {
  if (color === C.amber) {
    const notice = clamp(origin.notice || 0, 0, 1);
    const blend = [1, 3, 5].map((offset) => {
      const calm = parseInt(C.amber.slice(offset, offset + 2), 16);
      const hot = parseInt(C.red.slice(offset, offset + 2), 16);
      return Math.round(calm + (hot - calm) * notice);
    });
    color = `rgb(${blend.join(', ')})`;
    alpha += notice * 0.13;
  }
  const offsets = [];
  for (let i = 0; i <= 36; i++) offsets.push(-origin.halfAngle + origin.halfAngle * 2 * i / 36);
  for (const r of walls) {
    for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]) {
      const offset = angleDelta(origin.angle, Math.atan2(y - origin.y, x - origin.x));
      if (Math.abs(offset) < origin.halfAngle && Math.hypot(x - origin.x, y - origin.y) < origin.range) offsets.push(offset - 0.0001, offset + 0.0001);
    }
  }
  offsets.sort((a, b) => a - b);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  for (const offset of offsets) {
    const p = rayEnd(origin.x, origin.y, origin.angle + clamp(offset, -origin.halfAngle, origin.halfAngle), origin.range, walls);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = alpha + 0.1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function pools(ctx, x, y, rx, ry, color) {
  ctx.save();
  for (const [scale, alpha] of [[1.2, 0.035], [1, 0.055], [0.72, 0.07]]) {
    ctx.globalAlpha = alpha;
    ellipse(ctx, x, y, rx * scale, ry * scale, color);
  }
  ctx.restore();
}

function floors(ctx, S) {
  rect(ctx, 36, 112, 1080, 610, '#151f29');
  for (const f of S.level.floors) {
    rect(ctx, f.x, f.y, f.w, f.h, f.kind === 'gallery' ? C.gallery : f.kind === 'vault' ? C.vault : f.kind === 'corridor' ? C.corridor : f.kind === 'office' ? C.floorDark : C.floor);
    ctx.save();
    ctx.beginPath(); ctx.rect(f.x, f.y, f.w, f.h); ctx.clip();
    for (let x = 52; x < 1100; x += 48) line(ctx, x, f.y, x, f.y + f.h, '#ffffff07');
    for (let y = 128; y < 662; y += 48) line(ctx, f.x, y, f.x + f.w, y, '#ffffff07');
    if (f.kind === 'gallery') pools(ctx, f.x + f.w / 2, f.y + f.h / 2, f.w * 0.55, f.h * 0.56, C.galleryLight);
    ctx.restore();
  }
  pools(ctx, 576, 550, 210, 126, C.gold);
  pools(ctx, 998, 225, 92, 78, C.cyan);
  rect(ctx, 460, 544, 232, 103, '#22313a');
  border(ctx, { x: 465, y: 549, w: 222, h: 93 }, '#be9d5940');
  polygon(ctx, [[576, 561], [614, 585], [576, 609], [538, 585]], null, '#be9d5950');
  polygon(ctx, [[576, 568], [602, 585], [576, 602], [550, 585]], null, '#be9d5929');
  rect(ctx, 504, 663, 144, 60, '#1c2933');
  for (let x = 515; x < 648; x += 18) rect(ctx, x, 666, 9, 9, '#88969220');
  line(ctx, 54, 687, 493, 687, '#46535b50');
  line(ctx, 659, 687, 1098, 687, '#46535b50');
  for (const gap of S.level.doorGaps) {
    const horizontal = gap.w > gap.h;
    line(ctx, gap.x + 3, gap.y + 3, gap.x + (horizontal ? gap.w - 3 : 3), gap.y + (horizontal ? 3 : gap.h - 3), '#a49a754b');
    line(ctx, gap.x + gap.w - 3, gap.y + gap.h - 3, gap.x + (horizontal ? 3 : gap.w - 3), gap.y + (horizontal ? gap.h - 3 : 3), '#a49a754b');
  }
}

function office(ctx) {
  pools(ctx, 135, 187, 74, 48, C.cyan);
  rect(ctx, 74, 172, 106, 31, '#101d28');
  border(ctx, { x: 74, y: 172, w: 106, h: 31 }, '#4d5e68');
  for (let i = 0; i < 3; i++) {
    rect(ctx, 81 + i * 31, 175, 25, 17, '#4a7b79');
    rect(ctx, 84 + i * 31, 178, 19, 11, i === 1 ? '#7ba99a' : '#3e6869');
    line(ctx, 85 + i * 31, 187, 99 + i * 31, 180, '#a2d4b450');
    rect(ctx, 92 + i * 31, 192, 4, 4, '#52666b');
  }
  ellipse(ctx, 130, 218, 13, 9, '#14232b');
  rect(ctx, 187, 155, 26, 28, '#192732');
  for (let i = 0; i < 3; i++) line(ctx, 190, 160 + i * 7, 210, 160 + i * 7, '#576975');
}

function cases(ctx, S) {
  S.level.loot.forEach((l, index) => {
    const t = S.visualTime || 0;
    if (l.diamond) {
      ellipse(ctx, l.x, l.y + 24, 48, 15, '#0b1d2580');
      rect(ctx, l.x - 33, l.y - 16, 66, 47, '#162b34');
      border(ctx, { x: l.x - 33, y: l.y - 16, w: 66, h: 47 }, '#628986');
      rect(ctx, l.x - 27, l.y - 12, 54, 36, '#294a4b');
      line(ctx, l.x - 27, l.y + 24, l.x + 27, l.y + 24, C.goldDark, 2);
      if (!l.taken) {
        diamond(ctx, l.x, l.y - 4, 22);
        sparkle(ctx, l.x + 28, l.y - 21, 4 + Math.sin(t * 2) * 1.5, C.cyan);
      }
      tracked(ctx, 'MERIDIAN DIAMOND', l.x, l.y + 48, 9.5, 1.25, l.taken ? C.quiet : C.cyan, 'center');
      text(ctx, l.taken ? 'SECURED' : money(l.value), l.x, l.y + 62, 11, l.taken ? C.quiet : C.gold, 'center');
      return;
    }
    const painting = l.kind === 'painting';
    const w = painting ? 44 : 36;
    const h = painting ? 32 : 30;
    ellipse(ctx, l.x + 2, l.y + h / 2 + 2, w * 0.62, 7, '#0a151a50');
    rect(ctx, l.x - w / 2, l.y - h / 2, w, h, '#172631');
    border(ctx, { x: l.x - w / 2, y: l.y - h / 2, w, h }, l.taken ? '#586165' : C.goldDark, 2);
    rect(ctx, l.x - w / 2 + 4, l.y - h / 2 + 4, w - 8, h - 8, l.taken ? '#1b2a32' : painting ? '#5a6863' : '#2c4146');
    if (!l.taken) {
      if (painting) {
        ellipse(ctx, l.x + 6, l.y - 3, 6, 6, index === 1 ? '#d5aa69' : '#c9c299');
        polygon(ctx, [[l.x - 17, l.y + 11], [l.x - 3, l.y - 6], [l.x + 9, l.y + 11]], '#253f4a');
        polygon(ctx, [[l.x - 2, l.y + 11], [l.x + 11, l.y + 1], [l.x + 17, l.y + 11]], '#838978');
      } else if (l.kind === 'jewel') {
        ellipse(ctx, l.x, l.y, 8, 7, C.gold);
        ellipse(ctx, l.x, l.y, 4, 4, '#dedec0');
      } else {
        polygon(ctx, [[l.x - 6, l.y + 6], [l.x - 4, l.y - 5], [l.x + 4, l.y - 5], [l.x + 7, l.y + 6]], C.gold);
        line(ctx, l.x - 8, l.y + 8, l.x + 9, l.y + 8, '#c9a962', 2);
        ellipse(ctx, l.x, l.y - 7, 4, 3, '#eee0b0');
      }
      line(ctx, l.x - w / 2 + 4, l.y - h / 2 + 5, l.x - 2, l.y - h / 2 + 5, '#c1e4da70');
      sparkle(ctx, l.x + w / 2 - 1, l.y - h / 2 - 2, 3 + Math.sin(t * 2 + index) * 1.2);
    }
  });
}

function walls(ctx, S) {
  for (const r of S.level.walls) {
    rect(ctx, r.x + 3, r.y + 4, r.w, r.h, '#07101b55');
    rect(ctx, r.x, r.y, r.w, r.h, C.wall);
    rect(ctx, r.x + 1, r.y + 1, r.w - 2, 2, C.wallEdge);
    if (r.w === 36 && r.h === 42) {
      rect(ctx, r.x + 6, r.y + 7, 24, 24, '#41515a');
      polygon(ctx, [[r.x + 18, r.y + 4], [r.x + 27, r.y + 18], [r.x + 18, r.y + 28], [r.x + 9, r.y + 18]], '#89918a');
      line(ctx, r.x + 18, r.y + 8, r.x + 18, r.y + 23, '#c0bea0');
    }
  }
  const d = S.level.vaultDoor;
  if (!S.vaultOpen) {
    rect(ctx, d.x, d.y, d.w, d.h, '#4e6669');
    border(ctx, d, C.goldDark, 2);
    for (let y = d.y + 8; y < d.y + d.h; y += 10) line(ctx, d.x + 3, y, d.x + d.w - 3, y, '#91a5a2');
    ellipse(ctx, d.x + 7, d.y + 28, 3, 4, C.gold);
    text(ctx, 'LOCK', d.x - 8, d.y + 33, 9, C.gold, 'right');
  } else {
    rect(ctx, d.x, d.y - 5, d.w, 5, '#537b76');
  }
  if (S.alarm.lockdownT > 0) {
    rect(ctx, 504, 662, 144, 16, '#643a3e');
    for (let x = 509; x < 644; x += 17) line(ctx, x, 664, x + 11, 676, C.red, 2);
  }
}

function lasers(ctx, S) {
  for (const l of S.level.lasers) {
    ctx.save();
    if (l.active) {
      ctx.shadowColor = C.red;
      ctx.shadowBlur = 10;
      line(ctx, l.x1, l.y1, l.x2, l.y2, '#f27078', 2.5);
      ctx.shadowBlur = 0;
      line(ctx, l.x1, l.y1, l.x2, l.y2, '#ffd1c9', 0.8);
    } else {
      ctx.setLineDash([4, 5]);
      line(ctx, l.x1, l.y1, l.x2, l.y2, '#e7707840', 1);
    }
    ctx.restore();
    for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {
      rect(ctx, x - 4, y - 4, 8, 8, '#18242d');
      ellipse(ctx, x, y, 2, 2, l.active ? C.red : '#677f78');
    }
    const x = (l.x1 + l.x2) / 2;
    const y = (l.y1 + l.y2) / 2;
    text(ctx, `${l.active ? 'ON' : 'OFF'} ${(l.switchIn || 0).toFixed(1)}s`, l.x1 === l.x2 ? x + 10 : x, l.x1 === l.x2 ? y + 4 : y + 17, 9, l.active ? '#efa0a0' : '#8cab9b', l.x1 === l.x2 ? 'left' : 'center');
  }
}

function vents(ctx, S) {
  for (const v of S.level.vents) {
    const near = S.near && S.near.id === v.id;
    rect(ctx, v.x - 10, v.y - 9, 20, 18, '#111f28');
    border(ctx, { x: v.x - 10, y: v.y - 9, w: 20, h: 18 }, near ? C.cyan : '#688d8e');
    for (let y = -5; y < 8; y += 4) line(ctx, v.x - 7, v.y + y, v.x + 7, v.y + y, '#709093', 1.5);
    text(ctx, v.id, v.x, v.y + 22, 9, near ? C.cyan : '#8ca2a3', 'center');
  }
}

function van(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ellipse(ctx, 0, 13, 47, 13, '#08131a70');
  rect(ctx, -31, -18, 14, 6, '#0b121b');
  rect(ctx, 17, -18, 14, 6, '#0b121b');
  rect(ctx, -31, 12, 14, 6, '#0b121b');
  rect(ctx, 17, 12, 14, 6, '#0b121b');
  rect(ctx, -42, -15, 84, 30, '#526875');
  border(ctx, { x: -42, y: -15, w: 84, h: 30 }, '#93a8a7');
  rect(ctx, 12, -12, 11, 24, '#a1cbc3');
  rect(ctx, 27, -11, 11, 22, '#274751');
  line(ctx, -37, -10, 6, -10, '#8eaaa8');
  line(ctx, -37, 10, 6, 10, C.goldDark);
  line(ctx, 7, -13, 7, 13, '#253d48');
  rect(ctx, 39, -11, 3, 6, C.gold);
  rect(ctx, 39, 5, 3, 6, C.gold);
  rect(ctx, -44, -11, 3, 6, C.red);
  rect(ctx, -44, 5, 3, 6, C.red);
  ctx.restore();
}

function guard(ctx, g) {
  ellipse(ctx, g.x + 2, g.y + 7, 13, 8, '#06131d70');
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.angle + Math.PI / 2);
  rect(ctx, -8, 9, 6, 8, '#182c3e');
  rect(ctx, 2, 9, 6, 8, '#182c3e');
  ellipse(ctx, 0, 2, 11, 12, C.guardDark);
  rect(ctx, -10, -3, 20, 11, C.guard);
  ellipse(ctx, 0, -7, 7, 6, '#a8b6b4');
  ellipse(ctx, 0, -10, 9, 5, C.guard);
  rect(ctx, -8, -9, 16, 3, '#1d3c54');
  ellipse(ctx, 0, -11, 1.7, 1.7, C.gold);
  line(ctx, 0, -18, 0, -25, g.state === 'chase' ? C.red : C.amber, 2);
  ctx.restore();
  if (g.notice > 0.03) {
    ctx.beginPath();
    ctx.arc(g.x, g.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.notice);
    ctx.strokeStyle = g.state === 'chase' ? C.red : C.amber;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (g.state !== 'patrol') {
    ellipse(ctx, g.x, g.y - 31, 10, 11, '#162029');
    text(ctx, g.state === 'chase' ? '!' : '?', g.x, g.y - 25, 20, g.state === 'chase' ? C.red : C.amber, 'center', BODY, '700');
  } else if (g.wait > 0) {
    for (let i = -1; i <= 1; i++) ellipse(ctx, g.x + i * 5, g.y + 25, 1, 1, '#9baaa9');
  }
  text(ctx, g.id, g.x + 16, g.y + 19, 8.5, '#9baeb6');
}

function thief(ctx, p) {
  ellipse(ctx, p.x + 2, p.y + 8, 13, 7, '#04161c90');
  ctx.save();
  ctx.globalAlpha = p.invisibleT > 0 ? 0.5 : 1;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle + Math.PI / 2);
  const foot = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  rect(ctx, -7, 8 + foot, 5, 8, '#081d26');
  rect(ctx, 2, 8 - foot, 5, 8, '#081d26');
  ellipse(ctx, 0, 0, 10, 12, '#123e47');
  rect(ctx, -10, -4, 20, 8, C.teal);
  ellipse(ctx, 0, -8, 7, 7, '#0c2934');
  line(ctx, -5, -9, 5, -9, C.cyan, 2);
  line(ctx, 0, -18, 0, -22, C.cyan, 1.5);
  if (p.lootCount > 0) {
    const size = 5 + Math.min(9, p.lootValue / 1700);
    ellipse(ctx, 9, 8, size, size * 0.85, '#8b8060');
    ellipse(ctx, 8, 5, size * 0.7, size * 0.52, '#b1a47a');
    line(ctx, 7, 2, 11, 1, C.goldDark, 2);
    if (p.hasDiamond) diamond(ctx, 10, 6, 3);
  }
  ctx.restore();
  if (p.invisibleT > 0) {
    pools(ctx, p.x, p.y, 37, 31, '#b3d4d0');
    text(ctx, `HIDDEN ${p.invisibleT.toFixed(1)}s`, p.x, p.y + 33, 9, C.cyan, 'center');
  }
}

function effects(ctx, S) {
  for (const e of S.effects) {
    const progress = e.age / e.ttl;
    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.7;
    if (e.type === 'smoke') {
      for (let i = 0; i < 5; i++) ellipse(ctx, e.x + Math.cos(i * 1.3) * 22, e.y + Math.sin(i * 1.3) * 16, 18 + progress * 14, 15 + progress * 10, '#729696');
    } else {
      const radius = e.type === 'emp' ? 25 + progress * 370 : 10 + progress * 38;
      ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = e.type === 'laser' ? C.red : e.type === 'pickup' ? C.gold : C.cyan;
      ctx.lineWidth = 2 - progress;
      ctx.stroke();
      if (e.type === 'pickup') {
        for (let i = 0; i < 6; i++) sparkle(ctx, e.x + Math.cos(i * Math.PI / 3) * radius, e.y + Math.sin(i * Math.PI / 3) * radius, 3 * (1 - progress));
      }
    }
    ctx.restore();
  }
  if (S.decoy) {
    const d = S.decoy;
    toolIcon(ctx, 'decoy', d.x, d.y, C.gold, 0.7);
    if (d.fired) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      const radius = 12 + ((S.visualTime * 55) % 50);
      ctx.beginPath(); ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = C.gold; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }
}

function world(ctx, S) {
  floors(ctx, S);
  office(ctx);
  const wallList = S.walls || S.level.walls;
  for (const c of S.cameras) if (!c.disabled) cone(ctx, c, C.red, wallList, c.seesPlayer ? 0.18 : 0.1);
  for (const g of S.guards) cone(ctx, g, C.amber, wallList, g.state === 'chase' ? 0.21 : 0.13);
  cases(ctx, S);
  vents(ctx, S);
  walls(ctx, S);
  lasers(ctx, S);
  for (const room of S.level.rooms) tracked(ctx, room.name.toUpperCase(), room.x, room.y, 10.5, 1.8, room.name === 'Vault' ? '#91b6b2' : '#aeb5ab', 'center');
  for (const c of S.cameras) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    rect(ctx, -8, -6, 16, 12, c.disabled ? '#4b5a61' : '#81908e');
    rect(ctx, 5, -4, 7, 8, '#142730');
    ellipse(ctx, 9, 0, 2.5, 2.5, c.disabled ? '#60706f' : C.red);
    ctx.restore();
    text(ctx, c.disabled ? `OFF ${c.disabledT.toFixed(1)}s` : c.id, c.x, c.y - 13, 8.5, c.disabled ? '#879793' : '#bf9995', 'center');
  }
  for (const g of S.guards) guard(ctx, g);
  effects(ctx, S);
  thief(ctx, S.player);
  ctx.save(); ctx.setLineDash([4, 4]);
  border(ctx, S.level.van, S.alarm.lockdownT > 0 ? '#ad666b' : '#71938c');
  ctx.restore();
  van(ctx, S.level.van.x + S.level.van.w / 2, S.level.van.y + S.level.van.h / 2);
  text(ctx, S.alarm.lockdownT > 0 ? `EXIT SEALED · ${S.alarm.lockdownT.toFixed(1)}s` : 'GETAWAY VAN', 666, 704, 10, S.alarm.lockdownT > 0 ? C.red : '#a3b9ad');
  if (S.player.channel) {
    const p = S.player;
    const progress = p.channel.t / p.channel.need;
    ctx.beginPath(); ctx.arc(p.x, p.y, 19, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.stroke();
  }
  if (S.near) {
    const p = S.player;
    const n = S.near;
    let label = n.type === 'loot' ? `${n.name} · ${money(n.value)}` : n.type === 'vent' ? `Vent ${n.id} → ${n.partner}` : n.type === 'door' ? 'Vault door · hold to unlock' : S.alarm.lockdownT > 0 ? 'Exit sealed by lockdown' : p.hasDiamond ? 'Get to the van · hold to escape' : 'The van needs the diamond';
    if (p.channel) label = `${p.channel.label} · ${Math.max(0, p.channel.need - p.channel.t).toFixed(1)}s`;
    ctx.font = `12px ${BODY}`;
    const width = Math.max(126, ctx.measureText(label).width + 44);
    const x = clamp(p.x - width / 2, 55, 1095 - width);
    const y = clamp(p.y - 54, 156, 670);
    rect(ctx, x, y, width, 27, '#101d29ed');
    border(ctx, { x, y, w: width, h: 27 }, '#6a8880');
    text(ctx, 'E', x + 14, y + 18, 12, C.cyan, 'center', BODY, '700');
    text(ctx, label, x + 29, y + 18, 11.5, C.ink);
  }
}

function soundButton(ctx, S) {
  button(ctx, S, UI_LAYOUT.mute, '');
  const r = UI_LAYOUT.mute;
  polygon(ctx, [[r.x + 8, r.y + 13], [r.x + 12, r.y + 13], [r.x + 18, r.y + 8], [r.x + 18, r.y + 26], [r.x + 12, r.y + 21], [r.x + 8, r.y + 21]], C.muted);
  if (S.muted) line(ctx, r.x + 6, r.y + 26, r.x + 26, r.y + 7, C.red, 1.5);
  else line(ctx, r.x + 23, r.y + 12, r.x + 23, r.y + 22, C.gold, 2);
}

function hud(ctx, S) {
  rect(ctx, 0, 0, W, 99, '#101a25');
  line(ctx, 32, 98, 1120, 98, '#63766d55');
  diamond(ctx, 35, 39, 9);
  tracked(ctx, 'MIDNIGHT', 57, 33, 14, 1.6, C.ink, 'left', DISPLAY);
  tracked(ctx, 'MERIDIAN', 57, 54, 18, 1.7, C.ink, 'left', DISPLAY);
  const a = S.alarm;
  const color = a.value < 35 ? C.green : a.value < 70 ? C.amber : C.red;
  tracked(ctx, 'ALARM', 244, 27, 10.5, 2, C.muted);
  rect(ctx, 244, 40, 222, 9, '#384852');
  rect(ctx, 244, 40, 222 * a.value / 100, 9, color);
  for (let i = 1; i < 10; i++) rect(ctx, 244 + 222 * i / 10, 40, 1, 9, '#101a253b');
  text(ctx, `${Math.round(a.value)}%`, 480, 49, 15, color);
  tracked(ctx, 'CARRIED LOOT', 552, 27, 10, 1.7, C.muted);
  text(ctx, money(S.player.lootValue), 551, 55, 25, C.gold, 'left', DISPLAY);
  tracked(ctx, 'ELAPSED', 745, 27, 10, 1.7, C.muted);
  text(ctx, clock(S.time), 744, 55, 25, C.ink, 'left', DISPLAY);
  if (a.tripped) text(ctx, a.recovering ? 'ALARM DRAINING' : `HIDE ${Math.max(0, 3 - S.hiddenT).toFixed(1)}s`, 863, 49, 11, C.red);
  else text(ctx, S.player.hasDiamond ? 'DIAMOND SECURED' : 'DIAMOND IN VAULT', 862, 49, 10.5, S.player.hasDiamond ? C.cyan : C.quiet);
  const toolPositions = [244, 408, 571, 750];
  ['emp', 'decoy', 'smoke', 'lockpick'].forEach((tool, i) => {
    const x = toolPositions[i];
    const count = S.player.tools[tool];
    const color = count ? C.gold : C.quiet;
    if (i < 3) {
      rect(ctx, x, 70, 19, 19, '#253643');
      text(ctx, i + 1, x + 9.5, 84, 11, color, 'center');
    }
    toolIcon(ctx, tool, x + (i < 3 ? 35 : 11), 82, color, 0.58);
    text(ctx, `${tool === 'lockpick' ? 'LOCKPICK' : tool.toUpperCase()} ${tool === 'lockpick' ? count ? '✓' : '—' : `× ${count}`}`, x + (i < 3 ? 53 : 29), 85, 10.5, color);
  });
  text(ctx, S.empT > 0 ? `CAMERAS OFF ${S.empT.toFixed(1)}s` : 'SHIFT = QUIET', 1119, 84, 10.5, S.empT > 0 ? C.cyan : C.quiet, 'right');
  soundButton(ctx, S);
  button(ctx, S, UI_LAYOUT.pause, '');
  rect(ctx, UI_LAYOUT.pause.x + 10, 32, 4, 14, C.muted);
  rect(ctx, UI_LAYOUT.pause.x + 19, 32, 4, 14, C.muted);
  rect(ctx, 0, 730, W, 38, '#101a25');
  line(ctx, 32, 730, 1120, 730, '#63766d55');
  tracked(ctx, 'OBJECTIVE', 34, 753, 9, 1.2, C.gold);
  text(ctx, S.objective, 126, 753, 12, C.ink);
  text(ctx, 'P / ESC  PAUSE     R  REPLAN', 1119, 753, 9.5, C.quiet, 'right');
  if (S.toastT > 0) {
    rect(ctx, 53, 693, Math.min(443, 26 + S.toast.length * 6.4), 25, '#101d29e8');
    text(ctx, S.toast, 65, 710, 10.5, C.cyan);
  }
}

function menuHeader(ctx, S, right = 'MERIDIAN MUSEUM  /  23:58') {
  diamond(ctx, 34, 47, 8);
  tracked(ctx, 'MIDNIGHT MERIDIAN', 56, 54, 17, 1.6, C.ink, 'left', DISPLAY);
  tracked(ctx, right, 1022, 51, 10, 1.4, C.muted, 'right');
  line(ctx, 32, 79, 1120, 79, '#596e6c60');
  soundButton(ctx, S);
}

function title(ctx, S) {
  rect(ctx, 515, 80, 637, 688, '#152430');
  for (let i = 0; i < 5; i++) {
    const x = 589 + i * 124;
    rect(ctx, x, 160, 29, 370, '#24363e');
    rect(ctx, x + 4, 166, 21, 349, '#1c2d37');
    line(ctx, x + 4, 163, x + 25, 163, '#777c68');
    rect(ctx, x - 8, 517, 45, 13, '#2b3b41');
  }
  pools(ctx, 861, 484, 251, 125, C.galleryLight);
  polygon(ctx, [[573, 167], [865, 111], [1152, 167]], null, '#b49c6540', 2);
  polygon(ctx, [[630, 210], [865, 164], [1102, 210]], null, '#b49c6530');
  ellipse(ctx, 864, 468, 111, 37, '#0b202a80');
  rect(ctx, 790, 416, 148, 55, '#2b4247');
  rect(ctx, 803, 408, 122, 18, '#526a68');
  rect(ctx, 812, 433, 104, 27, '#203941');
  border(ctx, { x: 812, y: 433, w: 104, h: 27 }, '#9c94694a');
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    line(ctx, 864 + Math.cos(a) * 125, 317 + Math.sin(a) * 125, 864 + Math.cos(a) * 139, 317 + Math.sin(a) * 139, '#7be6de24');
  }
  diamond(ctx, 864, 315, 82, true);
  sparkle(ctx, 951, 273, 9, '#b2fff0');
  sparkle(ctx, 801, 357, 5, '#7be6de');
  tracked(ctx, 'THE MERIDIAN DIAMOND', 864, 502, 10, 2.5, C.gold, 'center');
  const fakeGuard = { x: 1065, y: 586, angle: -2.49, halfAngle: 0.39, range: 279, state: 'patrol', notice: 0, wait: 0, id: '03' };
  cone(ctx, fakeGuard, C.amber, [], 0.095);
  guard(ctx, fakeGuard);
  thief(ctx, { x: 648, y: 561, angle: -0.57, lootValue: 1600, lootCount: 2, moving: false, invisibleT: 0, hasDiamond: false });
  ctx.save(); ctx.setLineDash([3, 6]);
  line(ctx, 651, 636, 756, 636, '#86b1a660');
  line(ctx, 756, 636, 756, 575, '#86b1a660');
  line(ctx, 756, 575, 863, 575, '#86b1a660');
  ctx.restore();
  tracked(ctx, 'MIDNIGHT', 74, 209, 35, 6.2, C.ink, 'left', DISPLAY);
  text(ctx, 'MERIDIAN', 69, 300, 79, C.ink, 'left', DISPLAY);
  line(ctx, 76, 330, 426, 330, '#a88c575c');
  sparkle(ctx, 440, 330, 5, C.gold);
  text(ctx, 'A top-down stealth heist.', 74, 375, 18, C.gold);
  text(ctx, 'Lift the Meridian Diamond.', 74, 422, 17, C.muted);
  text(ctx, 'Get back to the van. Leave no trace.', 74, 450, 17, C.muted);
  button(ctx, S, UI_LAYOUT.title, 'PLAN THE HEIST', true);
  text(ctx, 'ENTER to plan your loadout', 74, 627, 12, C.muted);
  tracked(ctx, 'ONE MUSEUM. THREE WAYS IN.', 74, 707, 10.5, 1.7, C.quiet);
  menuHeader(ctx, S);
}

function miniMap(ctx, S) {
  ctx.save();
  ctx.translate(74, 416);
  ctx.scale(0.35, 0.35);
  ctx.translate(-36, -112);
  floors(ctx, S);
  for (const r of S.level.walls) rect(ctx, r.x, r.y, r.w, r.h, '#71818a');
  for (const l of S.level.loot) {
    if (l.diamond) diamond(ctx, l.x, l.y, 16);
    else ellipse(ctx, l.x, l.y, 5, 5, C.gold);
  }
  ctx.setLineDash([8, 10]);
  line(ctx, 576, 629, 549, 224, C.gold, 2);
  line(ctx, 549, 224, 837, 224, C.gold, 2);
  line(ctx, 837, 224, 997, 229, C.gold, 2);
  for (const v of S.level.vents) {
    ellipse(ctx, v.x, v.y, 10, 10, C.cyanDark);
    text(ctx, v.id, v.x, v.y + 4, 12, C.cyan, 'center');
  }
  ctx.restore();
  text(ctx, 'Hall → service passage', 74, 656, 11, C.gold);
  text(ctx, 'East gallery → north stair', 74, 676, 11, C.gold);
  text(ctx, 'Cyan grates connect the vent routes', 74, 696, 11, C.cyan);
}

function loadout(ctx, S) {
  menuHeader(ctx, S, 'FIELD PREPARATION');
  text(ctx, 'Pick your way', 72, 190, 46, C.ink, 'left', DISPLAY);
  text(ctx, 'through the night.', 72, 247, 46, C.ink, 'left', DISPLAY);
  text(ctx, '600 credits. Spend them on tools,', 74, 292, 16, C.muted);
  text(ctx, 'or keep them for your final score.', 74, 318, 16, C.muted);
  text(ctx, 'Sneak near guards. Hold E to steal.', 74, 365, 15, C.gold);
  miniMap(ctx, S);
  rect(ctx, 530, 130, 548, 475, '#192630');
  line(ctx, 560, 196, 1038, 196, '#66776b65');
  tracked(ctx, 'YOUR LOADOUT', 560, 175, 11, 2, C.gold);
  text(ctx, `${BUDGET} CREDIT BUDGET`, 1038, 175, 11, C.muted, 'right');
  const labels = {
    emp: ['EMP charge', 'Cameras go dark for 8 seconds.'],
    decoy: ['Decoy', 'Aim with the mouse. Draw guards away.'],
    smoke: ['Smoke pellet', 'Stay invisible to cones for 3 seconds.'],
    lockpick: ['Lockpick set', 'Halves case and vault channel times.'],
  };
  LOADOUT_LAYOUT.rows.forEach((row, index) => {
    const selected = S.loadoutFocus === index;
    if (selected) rect(ctx, row.x - 12, row.y + 5, 3, row.h - 10, C.gold);
    toolIcon(ctx, row.tool, 590, row.y + 43, S.loadout[row.tool] ? C.gold : C.quiet, 1.3);
    text(ctx, labels[row.tool][0], 626, row.y + 29, 18, C.ink);
    text(ctx, `${PRICES[row.tool]} credits`, 626, row.y + 49, 11.5, C.gold);
    text(ctx, labels[row.tool][1], 626, row.y + 68, 11, C.muted);
    if (row.toggle) {
      button(ctx, S, row.toggle, S.loadout.lockpick ? 'EQUIPPED  ✓' : 'EQUIP');
    } else {
      button(ctx, S, row.minus, '−', false, S.loadout[row.tool] === 0);
      text(ctx, S.loadout[row.tool], 964, row.y + 53, 24, C.ink, 'center', DISPLAY);
      button(ctx, S, row.plus, '+', false, S.credits < PRICES[row.tool]);
    }
    if (index < 3) line(ctx, row.x, row.y + row.h - 1, row.x + row.w, row.y + row.h - 1, '#53656d55');
  });
  tracked(ctx, 'UNSPENT CREDITS', 560, 578, 10, 1.4, C.muted);
  text(ctx, S.credits, 1038, 582, 27, C.gold, 'right', DISPLAY);
  button(ctx, S, LOADOUT_LAYOUT.start, 'START THE HEIST', true);
  text(ctx, '↑ ↓ choose tool   ← → adjust   SPACE toggle   ENTER start', 560, 721, 11, C.muted);
  if (S.toastT > 0) text(ctx, S.toast, 1038, 612, 11, C.red, 'right');
}

function overlay(ctx, S, busted = false) {
  rect(ctx, 0, 0, W, H, '#09131dd9');
  const panel = { x: 334, y: 206, w: 484, h: 402 };
  rect(ctx, panel.x, panel.y, panel.w, panel.h, '#16232f');
  border(ctx, panel, busted ? '#b1676b' : '#7f8063');
  diamond(ctx, 576, 258, 14);
  if (busted) {
    text(ctx, 'BUSTED', 576, 352, 65, C.red, 'center', DISPLAY);
    text(ctx, `Guard ${S.caughtBy || '02'} closed the distance.`, 576, 402, 16, C.ink, 'center');
    text(ctx, `${money(S.player.lootValue)} carried · ${clock(S.time)} elapsed`, 576, 434, 14, C.muted, 'center');
    text(ctx, 'Break sight, then move. Smoke buys three seconds.', 576, 475, 12, C.muted, 'center');
    button(ctx, S, UI_LAYOUT.retry, 'PLAN ANOTHER HEIST', true);
  } else {
    text(ctx, 'Heist on hold.', 576, 341, 40, C.ink, 'center', DISPLAY);
    text(ctx, 'The museum will wait.', 576, 383, 16, C.muted, 'center');
    text(ctx, 'P or Escape to resume · R for a new loadout', 576, 434, 12, C.gold, 'center');
    button(ctx, S, UI_LAYOUT.resume, 'RESUME THE HEIST', true);
    text(ctx, 'M toggles sound', 576, 567, 11, C.quiet, 'center');
  }
}

function star(ctx, x, y, radius, color) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const size = i % 2 ? radius * 0.43 : radius;
    points.push([x + Math.cos(angle) * size, y + Math.sin(angle) * size]);
  }
  polygon(ctx, points, color);
}

function getaway(ctx, S) {
  const score = S.score;
  menuHeader(ctx, S, 'THE DIAMOND IS YOURS');
  tracked(ctx, 'MERIDIAN DIAMOND SECURED', 74, 151, 10.5, 1.8, C.cyan);
  text(ctx, score.ghost > 0 ? 'CLEAN' : 'LATE', 69, 232, 68, C.ink, 'left', DISPLAY);
  text(ctx, 'GETAWAY', 69, 312, 68, C.ink, 'left', DISPLAY);
  for (let i = 0; i < 5; i++) star(ctx, 91 + i * 48, 365, 17, i < score.stars ? C.gold : '#36444b');
  text(ctx, score.rank, 74, 415, 17, C.gold);
  text(ctx, `${S.player.lootCount} exhibits lifted in ${clock(S.time)}.`, 74, 443, 14, C.muted);
  rect(ctx, 72, 478, 438, 117, '#1e303b');
  for (let x = 83; x < 505; x += 44) line(ctx, x, 584, x + 20, 584, '#ad9a6760', 2);
  van(ctx, 285, 533, 3.15);
  button(ctx, S, UI_LAYOUT.again, 'PLAN ANOTHER HEIST', true);
  text(ctx, 'R to return to your loadout', 74, 719, 12, C.muted);
  tracked(ctx, 'THE TAKE', 608, 151, 11, 2, C.gold);
  line(ctx, 608, 172, 1078, 172, '#7c876461');
  const rows = [
    ['Loot secured', money(score.loot), 'Art, jewels, and the Meridian Diamond'],
    ['Time bonus', money(score.timeBonus), '25 points per second left under 4 minutes'],
    ['Ghost bonus', money(score.ghost), score.ghost ? 'Alarm never passed 50' : 'Alarm passed 50 during this run'],
    ['Phantom bonus', money(score.phantom), score.phantom ? 'Never seen by a guard or camera' : 'A guard or camera glimpsed you'],
    ['Unspent credits', money(score.unspent), 'What you kept from the 600-credit budget'],
  ];
  rows.forEach(([label, amount, detail], i) => {
    const y = 210 + i * 66;
    text(ctx, label, 608, y, 17, C.ink);
    text(ctx, amount, 1078, y + 1, 23, i === 0 ? C.gold : C.ink, 'right', DISPLAY);
    text(ctx, detail, 608, y + 21, 10.5, C.muted);
    line(ctx, 608, y + 37, 1078, y + 37, '#53616b4a');
  });
  rect(ctx, 592, 566, 502, 90, '#20383e');
  tracked(ctx, 'TOTAL SCORE', 608, 597, 11, 1.5, C.cyan);
  text(ctx, money(score.total), 1078, 631, 41, C.ink, 'right', DISPLAY);
  text(ctx, `${score.stars} / 5 STARS`, 608, 635, 11, C.gold);
  text(ctx, 'A good thief knows when to leave.', 1078, 711, 12, C.quiet, 'right');
}

export function drawScene(ctx, S) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  rect(ctx, 0, 0, W, H, C.background);
  if (S.screen === 'title') title(ctx, S);
  else if (S.screen === 'loadout') loadout(ctx, S);
  else if (S.screen === 'getaway') getaway(ctx, S);
  else {
    world(ctx, S);
    hud(ctx, S);
    if (S.screen === 'paused') overlay(ctx, S);
    if (S.screen === 'busted') overlay(ctx, S, true);
  }
}
