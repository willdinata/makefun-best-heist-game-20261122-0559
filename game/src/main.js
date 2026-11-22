import { W, H, STEP, BUDGET, PRICES, CAMERA_DETECTION, HIDE_SECONDS } from './config.js';
import { LEVEL } from './level.js';
import { keysDown, keysPressed, mouse, initInput, update as updateInput, endFrame } from './input.js';
import { clamp, segHit, segmentDistance } from './vision.js';
import { makeAlarm } from './alarm.js';
import { ensureAudio, sfx } from './audio.js';
import { makeGuard, updateGuard } from './guards.js';
import { makeCamera, updateCamera } from './cameras.js';
import { makePlayer, updatePlayer } from './player.js';
import { drawScene, LOADOUT_LAYOUT, UI_LAYOUT } from './render.js';
import { sceneFromUrl, stageScene } from './shots.js';

const DEFAULT_LOADOUT = { emp: 1, decoy: 1, smoke: 1, lockpick: true };
const PLAY_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'Digit1', 'Digit2', 'Digit3'];
const hit = (r) => r && mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h;
const cost = (loadout) => Object.entries(PRICES).reduce((sum, [tool, price]) => sum + Number(loadout[tool]) * price, 0);

function freshLevel() {
  const level = {
    ...LEVEL,
    loot: LEVEL.loot.map((l) => ({ ...l, type: 'loot', taken: false })),
    vents: LEVEL.vents.map((v) => ({ ...v, type: 'vent' })),
    lasers: LEVEL.lasers.map((l) => ({ ...l, active: false, wasActive: false, switchIn: 0, cooldown: 0 })),
  };
  for (const v of level.vents) v.destination = level.vents.find((partner) => partner.id === v.partner);
  return level;
}

function worldWalls(S) {
  const walls = [...S.level.walls];
  if (!S.vaultOpen) walls.push(S.level.vaultDoor);
  if (S.alarm.lockdownT > 0) walls.push({ x: 504, y: 662, w: 144, h: 16 });
  return walls;
}

export function makeState() {
  const loadout = { ...DEFAULT_LOADOUT };
  const S = {
    screen: 'title', level: freshLevel(), loadout, credits: BUDGET - cost(loadout),
    loadoutFocus: 0, player: makePlayer(LEVEL.start, loadout),
    guards: LEVEL.guardDefs.map(makeGuard), cameras: LEVEL.cameraDefs.map(makeCamera),
    alarm: makeAlarm(), time: 0, visualTime: 0, hiddenT: 0,
    empT: 0, smokeT: 0, decoy: null, activeDecoy: null, noise: null,
    walls: [], near: null, vaultOpen: false, escaped: false, caughtBy: null,
    effects: [], toast: '', toastT: 0, tickT: 0, score: null,
    objective: 'Find the Meridian Diamond in the north-east vault.',
    pointer: mouse, muted: false, staged: false,
  };
  S.walls = worldWalls(S);
  return S;
}

function resetWorld(S, screen) {
  S.level = freshLevel();
  S.player = makePlayer(S.level.start, S.loadout);
  S.guards = S.level.guardDefs.map(makeGuard);
  S.cameras = S.level.cameraDefs.map(makeCamera);
  S.alarm = makeAlarm();
  Object.assign(S, {
    screen, credits: BUDGET - cost(S.loadout), time: 0, hiddenT: 0,
    empT: 0, smokeT: 0, decoy: null, activeDecoy: null, noise: null,
    near: null, vaultOpen: false, escaped: false, caughtBy: null,
    effects: [], toast: '', toastT: 0, tickT: 0, score: null, staged: false,
    objective: 'Find the Meridian Diamond in the north-east vault.',
  });
  S.walls = worldWalls(S);
  tickLasers(S, 0);
}

export function resolveNear(S) {
  const p = S.player;
  let nearest = null;
  let best = Infinity;
  const offer = (target, distance, range) => {
    if (distance <= range && distance < best) {
      best = distance;
      nearest = target;
    }
  };
  for (const l of S.level.loot) if (!l.taken) offer(l, Math.hypot(p.x - l.x, p.y - l.y), l.diamond ? 48 : 38);
  for (const v of S.level.vents) offer(v, Math.hypot(p.x - v.x, p.y - v.y), 28);
  if (!S.vaultOpen) {
    const d = S.level.vaultDoor;
    offer({ ...d, type: 'door', name: 'Vault door' }, Math.hypot(p.x - d.x - d.w / 2, p.y - d.y - d.h / 2), 43);
  }
  const v = S.level.van;
  const vanDistance = Math.hypot(p.x - clamp(p.x, v.x, v.x + v.w), p.y - clamp(p.y, v.y, v.y + v.h));
  offer({ ...v, id: 'getaway', type: 'van', name: 'Getting away' }, vanDistance + 4, 38);
  return nearest;
}

function adjustLoadout(S, tool, direction) {
  if (tool === 'lockpick') {
    if (!S.loadout.lockpick && S.credits < PRICES.lockpick) {
      S.toast = 'You need 200 unspent credits for lockpicks';
      S.toastT = 2;
      return;
    }
    if (direction > 0) S.loadout.lockpick = true;
    else if (direction < 0) S.loadout.lockpick = false;
    else S.loadout.lockpick = !S.loadout.lockpick;
  } else if (direction > 0) {
    if (S.credits < PRICES[tool]) {
      S.toast = `Not enough credits for another ${tool}`;
      S.toastT = 2;
      return;
    }
    S.loadout[tool]++;
  } else {
    S.loadout[tool] = Math.max(0, S.loadout[tool] - 1);
  }
  S.credits = BUDGET - cost(S.loadout);
  sfx.blip();
}

function screenInput(S) {
  if (keysPressed.has('KeyM') || mouse.clicked && hit(UI_LAYOUT.mute)) S.muted = sfx.toggleMute();
  if (keysPressed.has('KeyR')) {
    resetWorld(S, 'loadout');
    return;
  }
  if (S.screen === 'title') {
    if (keysPressed.has('Enter') || mouse.clicked && hit(UI_LAYOUT.title)) {
      S.screen = 'loadout';
      sfx.blip();
    }
  } else if (S.screen === 'loadout') {
    if (keysPressed.has('Escape')) { S.screen = 'title'; return; }
    if (keysPressed.has('ArrowDown') || keysPressed.has('Tab') && !keysDown.has('ShiftLeft') && !keysDown.has('ShiftRight')) S.loadoutFocus = (S.loadoutFocus + 1) % 4;
    if (keysPressed.has('ArrowUp') || keysPressed.has('Tab') && (keysDown.has('ShiftLeft') || keysDown.has('ShiftRight'))) S.loadoutFocus = (S.loadoutFocus + 3) % 4;
    ['Digit1', 'Digit2', 'Digit3'].forEach((key, index) => { if (keysPressed.has(key)) S.loadoutFocus = index; });
    const selected = LOADOUT_LAYOUT.rows[S.loadoutFocus].tool;
    if (keysPressed.has('ArrowLeft')) adjustLoadout(S, selected, -1);
    if (keysPressed.has('ArrowRight')) adjustLoadout(S, selected, 1);
    if (keysPressed.has('Space')) { S.loadoutFocus = 3; adjustLoadout(S, 'lockpick', 0); }
    if (mouse.clicked) {
      for (const [index, row] of LOADOUT_LAYOUT.rows.entries()) {
        if (hit(row)) S.loadoutFocus = index;
        if (hit(row.minus)) adjustLoadout(S, row.tool, -1);
        if (hit(row.plus)) adjustLoadout(S, row.tool, 1);
        if (hit(row.toggle)) adjustLoadout(S, row.tool, 0);
      }
    }
    if (keysPressed.has('Enter') || mouse.clicked && hit(LOADOUT_LAYOUT.start)) {
      resetWorld(S, 'playing');
      S.toast = 'Hold Shift to sneak · cyan grates are vents · hold E to interact';
      S.toastT = 5;
      sfx.blip();
    }
  } else if (S.screen === 'playing') {
    if (keysPressed.has('KeyP') || keysPressed.has('Escape') || mouse.clicked && hit(UI_LAYOUT.pause)) S.screen = 'paused';
  } else if (S.screen === 'paused') {
    if (keysPressed.has('KeyP') || keysPressed.has('Escape') || keysPressed.has('Enter') || mouse.clicked && hit(UI_LAYOUT.resume)) S.screen = 'playing';
  } else if (S.screen === 'busted' || S.screen === 'getaway') {
    const button = S.screen === 'busted' ? UI_LAYOUT.retry : UI_LAYOUT.again;
    if (keysPressed.has('Enter') || mouse.clicked && hit(button)) resetWorld(S, 'loadout');
  }
}

function tickLasers(S, dt) {
  for (const l of S.level.lasers) {
    const cycle = (S.time + l.phase) % l.period;
    l.wasActive = l.active;
    l.active = cycle < l.onFor;
    l.switchIn = l.active ? l.onFor - cycle : l.period - cycle;
    l.cooldown = Math.max(0, l.cooldown - dt);
  }
}

function tickDecoy(S, dt) {
  S.activeDecoy = null;
  if (!S.decoy) return;
  const d = S.decoy;
  d.delay -= dt;
  if (!d.fired && d.delay <= 0) {
    d.fired = true;
    d.noiseLife = 0.8;
    S.effects.push({ type: 'noise', x: d.x, y: d.y, age: 0, ttl: 0.8 });
    sfx.blip();
  }
  if (d.fired) {
    d.life -= dt;
    d.noiseLife -= dt;
    if (d.noiseLife > 0) S.activeDecoy = d;
    if (d.life <= 0) S.decoy = null;
  }
}

export function scoreRun(S) {
  const loot = S.player.lootValue;
  const timeBonus = Math.max(0, Math.floor((240 - S.time) * 25 + 0.000001));
  const ghost = S.alarm.maxValue <= 50 ? 2500 : 0;
  const phantom = !S.alarm.everSeen ? 4000 : 0;
  const unspent = S.credits;
  const total = loot + timeBonus + ghost + phantom + unspent;
  const stars = total >= 30000 ? 5 : total >= 23000 ? 4 : total >= 17000 ? 3 : total >= 12000 ? 2 : 1;
  const rank = ['After-hours amateur', 'Promising accomplice', 'Gallery ghost', 'Midnight professional', 'The perfect phantom'][stars - 1];
  return { loot, timeBonus, ghost, phantom, unspent, total, stars, rank };
}

function objective(S) {
  if (S.alarm.tripped && !S.alarm.recovering) return `Lockdown. Stay out of sight for ${Math.max(0, HIDE_SECONDS - S.hiddenT).toFixed(1)} more seconds.`;
  if (S.alarm.lockdownT > 0) return `Exit sealed for ${S.alarm.lockdownT.toFixed(1)} seconds. Find cover and keep the diamond safe.`;
  if (S.player.hasDiamond) return 'Diamond secured. Return to the van at the south doors and hold E.';
  if (S.alarm.value >= 70) return 'You are drawing attention. Break line of sight before going for the vault.';
  return S.vaultOpen ? 'Vault open. Wait for the laser to go dark, then steal the Meridian Diamond.' : 'Steal the Meridian Diamond. Use the galleries, service passage, or vents.';
}

export function stepGame(S, dt) {
  S.visualTime += dt;
  S.toastT = Math.max(0, S.toastT - dt);
  screenInput(S);
  if (S.screen !== 'playing') return;
  if (S.staged) {
    if (!PLAY_KEYS.some((key) => keysDown.has(key) || keysPressed.has(key))) return;
    S.staged = false;
    S.toastT = Math.min(3, S.toastT);
  }
  const oldTrips = S.alarm.trips;
  S.time += dt;
  S.empT = Math.max(0, S.empT - dt);
  S.smokeT = Math.max(0, S.smokeT - dt);
  S.effects = S.effects.filter((e) => { e.age += dt; return e.age < e.ttl; });
  S.walls = worldWalls(S);
  S.near = resolveNear(S);
  tickLasers(S, dt);
  updatePlayer(S.player, dt, S);
  S.walls = worldWalls(S);
  S.noise = S.player.noise;
  tickDecoy(S, dt);
  for (const g of S.guards) updateGuard(g, dt, S);
  for (const c of S.cameras) {
    c.player = S.player;
    c.walls = S.walls;
    updateCamera(c, dt, S.empT);
    if (c.seesPlayer) S.alarm.sight(dt, CAMERA_DETECTION);
  }
  const seen = S.guards.some((g) => g.seesPlayer) || S.cameras.some((c) => c.seesPlayer);
  S.hiddenT = seen ? 0 : S.hiddenT + dt;
  S.alarm.update(dt, S.hiddenT >= HIDE_SECONDS);
  const p = S.player;
  for (const l of S.level.lasers) {
    if (!l.active || l.cooldown > 0 || p.teleported) continue;
    const crossed = p.moving && segHit(p.previousX, p.previousY, p.x, p.y, l.x1, l.y1, l.x2, l.y2);
    const entering = segmentDistance(p.x, p.y, l.x1, l.y1, l.x2, l.y2) <= p.r
      && (segmentDistance(p.previousX, p.previousY, l.x1, l.y1, l.x2, l.y2) > p.r || !l.wasActive);
    if (crossed || entering) {
      S.alarm.laserHit();
      S.hiddenT = 0;
      l.cooldown = 0.9;
      S.effects.push({ type: 'laser', x: p.x, y: p.y, age: 0, ttl: 0.7 });
      S.toast = 'Live laser crossed · alarm +34';
      S.toastT = 3;
      sfx.tick(true);
    }
  }
  if (S.alarm.trips > oldTrips) {
    S.toast = 'LOCKDOWN · south doors sealed for 12 seconds · guards are faster';
    S.toastT = 4;
    // A shutter closes onto one side of a body, rather than trapping it inside a wall.
    for (const body of [S.player, ...S.guards]) {
      if (body.x > 494 && body.x < 658 && body.y > 651 && body.y < 688) body.y = body.y < 670 ? 650 : 690;
    }
    sfx.tick(true);
  }
  S.tickT -= dt;
  if (S.alarm.value > 20 && S.tickT <= 0) {
    sfx.tick(S.alarm.value > 70);
    S.tickT = Math.max(0.22, 0.9 - S.alarm.value * 0.006);
  }
  S.walls = worldWalls(S);
  S.near = resolveNear(S);
  S.objective = objective(S);
  const caught = S.guards.find((g) => g.caughtPlayer);
  if (caught) {
    S.screen = 'busted';
    S.caughtBy = caught.id;
    p.channel = null;
    sfx.sting();
  } else if (S.escaped) {
    S.screen = 'getaway';
    S.score = scoreRun(S);
    sfx.jingle();
  }
}

export const S = makeState();

function boot() {
  const canvas = document.getElementById('museum');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  initInput(canvas);
  window.addEventListener('keydown', ensureAudio);
  canvas.addEventListener('pointerdown', ensureAudio);
  const pauseOnBlur = () => { if (S.screen === 'playing') S.screen = 'paused'; };
  window.addEventListener('blur', pauseOnBlur);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnBlur(); });
  stageScene(S, sceneFromUrl());
  S.walls = worldWalls(S);
  S.near = resolveNear(S);
  S.objective = objective(S);
  tickLasers(S, 0);
  for (const c of S.cameras) { c.player = S.player; c.walls = S.walls; }
  const status = document.getElementById('game-status');
  let lastAnnouncement = '';
  let last = performance.now();
  let accumulator = 0;
  const frame = (now) => {
    accumulator += Math.min(0.12, Math.max(0, (now - last) / 1000));
    last = now;
    while (accumulator >= STEP) {
      updateInput();
      stepGame(S, STEP);
      endFrame();
      accumulator -= STEP;
    }
    drawScene(ctx, S);
    const controls = S.screen === 'title' ? [UI_LAYOUT.title]
      : S.screen === 'loadout' ? [LOADOUT_LAYOUT.start, ...LOADOUT_LAYOUT.rows.flatMap((row) => [row.minus, row.plus, row.toggle].filter(Boolean))]
        : S.screen === 'paused' ? [UI_LAYOUT.resume]
          : S.screen === 'busted' ? [UI_LAYOUT.retry]
            : S.screen === 'getaway' ? [UI_LAYOUT.again] : [UI_LAYOUT.pause];
    canvas.style.cursor = mouse.inside && [...controls, UI_LAYOUT.mute].some(hit) ? 'pointer' : S.screen === 'playing' ? 'crosshair' : 'default';
    const announcement = `${S.screen}. ${S.player.hasDiamond ? 'Diamond secured.' : 'Find the Meridian Diamond.'} ${S.alarm.tripped ? 'Alarm tripped. Find cover.' : ''}`;
    if (status && announcement !== lastAnnouncement) {
      status.textContent = announcement;
      lastAnnouncement = announcement;
    }
    requestAnimationFrame(frame);
  };
  drawScene(ctx, S);
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') boot();
