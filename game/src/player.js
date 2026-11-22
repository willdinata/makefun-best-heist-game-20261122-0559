import {
  W, PLAYER_RADIUS, RUN_SPEED, SNEAK_SPEED, MAX_LOOT_SLOWDOWN, RUN_NOISE_RADIUS,
  EMP_SECONDS, SMOKE_SECONDS, DECOY_DELAY, DECOY_RADIUS, INTERACT_RANGE,
} from './config.js';
import { keysDown, keysPressed, mouse } from './input.js';
import { clamp, circleBlocked, moveCircle } from './vision.js';
import { sfx } from './audio.js';

export function makePlayer(start, loadout) {
  return {
    x: start.x, y: start.y, r: PLAYER_RADIUS, angle: -Math.PI / 2,
    previousX: start.x, previousY: start.y,
    tools: { ...loadout }, lootValue: 0, lootCount: 0, hasDiamond: false,
    speedFactor: 1, channel: null, invisibleT: 0,
    sneaking: false, running: false, moving: false, walkPhase: 0,
    noise: null, noiseT: 0, noiseSerial: 0, toolSerial: 0,
    ventT: 0, teleported: false,
  };
}

function notify(ctx, text) {
  ctx.toast = text;
  ctx.toastT = 2.8;
}

function effect(ctx, type, x, y, ttl = 0.8) {
  if (!ctx.effects) ctx.effects = [];
  ctx.effects.push({ type, x, y, age: 0, ttl });
}

function tools(p, ctx) {
  if (keysPressed.has('Digit1')) {
    if (p.tools.emp > 0) {
      p.tools.emp--;
      ctx.empT = EMP_SECONDS;
      effect(ctx, 'emp', p.x, p.y, 1.15);
      notify(ctx, 'EMP fired · all cameras offline for 8 seconds');
      sfx.blip();
    } else notify(ctx, 'No EMP charges left');
  }
  if (keysPressed.has('Digit2')) {
    if (p.tools.decoy > 0) {
      const x = clamp(mouse.x, 62, 1090);
      const y = clamp(mouse.y, 138, 650);
      if (!circleBlocked(x, y, 5, ctx.walls)) {
        p.tools.decoy--;
        ctx.decoy = { x, y, id: `decoy-${++p.toolSerial}`, r: DECOY_RADIUS, delay: DECOY_DELAY, life: 3, fired: false };
        notify(ctx, 'Decoy planted · the distraction starts in half a second');
        sfx.blip();
      } else notify(ctx, 'Aim the decoy at open floor');
    } else notify(ctx, 'No decoys left');
  }
  if (keysPressed.has('Digit3')) {
    if (p.tools.smoke > 0) {
      p.tools.smoke--;
      p.invisibleT = SMOKE_SECONDS;
      ctx.smokeT = SMOKE_SECONDS;
      effect(ctx, 'smoke', p.x, p.y, SMOKE_SECONDS);
      notify(ctx, 'Smoke deployed · hidden from cones for 3 seconds');
      sfx.blip();
    } else notify(ctx, 'No smoke pellets left');
  }
}

function stillNear(p, near) {
  if (near.type === 'van') {
    const dx = p.x - clamp(p.x, near.x, near.x + near.w);
    const dy = p.y - clamp(p.y, near.y, near.y + near.h);
    return Math.hypot(dx, dy) <= INTERACT_RANGE;
  }
  const x = near.type === 'door' ? near.x + near.w / 2 : near.x;
  const y = near.type === 'door' ? near.y + near.h / 2 : near.y;
  return Math.hypot(p.x - x, p.y - y) <= (near.diamond ? 49 : INTERACT_RANGE + 4);
}

function interact(p, dt, ctx) {
  const near = ctx.near;
  if (!near || !keysDown.has('KeyE') || p.moving || !stillNear(p, near)) {
    p.channel = null;
    return;
  }
  if (near.type === 'vent') {
    p.channel = null;
    if (keysPressed.has('KeyE') && p.ventT <= 0 && near.destination) {
      effect(ctx, 'vent', p.x, p.y, 0.6);
      p.x = near.destination.x;
      p.y = near.destination.y;
      p.teleported = true;
      p.ventT = 0.8;
      p.invisibleT = Math.max(p.invisibleT, 0.3);
      p.noise = null;
      effect(ctx, 'vent', p.x, p.y, 0.6);
      notify(ctx, `Vent ${near.id} → ${near.destination.id} · back on the floor`);
      sfx.blip();
    }
    return;
  }
  if (near.type === 'van' && (!p.hasDiamond || ctx.alarm.lockdownT > 0)) {
    p.channel = null;
    if (keysPressed.has('KeyE')) notify(ctx, p.hasDiamond ? 'Exit sealed · wait out the lockdown' : 'Bring the Meridian Diamond back to the van');
    return;
  }
  const need = near.type === 'van' ? 0.65 : near.channel * (p.tools.lockpick ? 0.5 : 1);
  if (!p.channel || p.channel.target !== near.id) {
    p.channel = { target: near.id, t: 0, need, label: near.name || (near.type === 'door' ? 'Picking the vault lock' : 'Getting away') };
  }
  p.channel.t += dt;
  if (p.channel.t < p.channel.need) return;
  p.channel = null;
  if (near.type === 'loot' && !near.taken) {
    near.taken = true;
    p.lootValue += near.value;
    p.lootCount++;
    if (near.diamond) p.hasDiamond = true;
    effect(ctx, 'pickup', near.x, near.y, 1.1);
    notify(ctx, `${near.name} secured · $${near.value.toLocaleString('en-US')}`);
    sfx.pickup();
  } else if (near.type === 'door') {
    ctx.vaultOpen = true;
    effect(ctx, 'vent', near.x + near.w / 2, near.y + near.h / 2, 0.75);
    notify(ctx, 'Vault unlocked · watch the laser cycle');
    sfx.blip();
  } else if (near.type === 'van') {
    ctx.escaped = true;
  }
}

export function updatePlayer(p, dt, ctx) {
  p.previousX = p.x;
  p.previousY = p.y;
  p.teleported = false;
  p.invisibleT = Math.max(0, p.invisibleT - dt);
  p.ventT = Math.max(0, p.ventT - dt);
  p.noiseT = Math.max(0, p.noiseT - dt);
  p.noise = null;
  tools(p, ctx);
  const held = (...codes) => codes.some((code) => keysDown.has(code));
  let dx = Number(held('KeyD', 'ArrowRight')) - Number(held('KeyA', 'ArrowLeft'));
  let dy = Number(held('KeyS', 'ArrowDown')) - Number(held('KeyW', 'ArrowUp'));
  const length = Math.hypot(dx, dy);
  p.sneaking = held('ShiftLeft', 'ShiftRight');
  p.speedFactor = 1 - Math.min(MAX_LOOT_SLOWDOWN, p.lootValue / 100000);
  if (length > 0) {
    dx /= length;
    dy /= length;
    const speed = (p.sneaking ? SNEAK_SPEED : RUN_SPEED) * p.speedFactor;
    moveCircle(p, dx * speed * dt, dy * speed * dt, ctx.walls);
    p.x = clamp(p.x, p.r + 4, W - p.r - 4);
    p.y = clamp(p.y, 128 + p.r, 726 - p.r);
    p.angle = Math.atan2(dy, dx);
  }
  p.moving = Math.hypot(p.x - p.previousX, p.y - p.previousY) > 0.05;
  p.running = p.moving && !p.sneaking;
  if (p.moving) p.walkPhase += dt * (p.sneaking ? 8 : 13);
  if (p.running && p.noiseT <= 0) {
    p.noise = { x: p.x, y: p.y, r: RUN_NOISE_RADIUS, id: `step-${++p.noiseSerial}` };
    p.noiseT = 0.6;
  }
  interact(p, dt, ctx);
  p.speedFactor = 1 - Math.min(MAX_LOOT_SLOWDOWN, p.lootValue / 100000);
}
