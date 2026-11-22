import {
  W, H, GUARD_SPEED, CHASE_SPEED, LOCKDOWN_SPEED, GUARD_RANGE, GUARD_HALF_ANGLE,
  GUARD_DETECTION, NOTICE_CLEAR_RATE, NOTICE_EDGE_RATE,
} from './config.js';
import { angleDelta, circleBlocked, inCone, losBlocked, moveCircle } from './vision.js';

export function makeGuard(def) {
  const [x, y] = def.waypoints[0];
  const next = def.waypoints[1] || def.waypoints[0];
  return {
    id: def.id || '01', x, y, r: 10,
    waypoints: def.waypoints.map((p) => [...p]), waypoint: 1 % def.waypoints.length,
    pause: def.pause || 1.1, wait: def.pause || 1.1,
    angle: Math.atan2(next[1] - y, next[0] - x),
    halfAngle: GUARD_HALF_ANGLE, range: GUARD_RANGE,
    state: 'patrol', notice: 0, seesPlayer: false, caughtPlayer: false,
    lastSeen: { x, y }, target: { x, y }, lostT: 0,
    suspiciousT: 0, reactT: 0, searchT: 0, searchAngle: 0,
    route: [], routeT: 0, heardNoises: new Set(),
  };
}

function turn(g, angle, dt, speed = 3) {
  const delta = angleDelta(g.angle, angle);
  g.angle += Math.sign(delta) * Math.min(Math.abs(delta), speed * dt);
}

// A small four-neighbour navigation grid lets pursuits take doorways, never cut through walls.
function findRoute(g, goal, walls) {
  const cell = 22;
  const cols = Math.ceil(W / cell);
  const rows = Math.ceil(H / cell);
  const centre = (index) => ({ x: (index % cols + 0.5) * cell, y: (Math.floor(index / cols) + 0.5) * cell });
  const usable = new Int8Array(cols * rows);
  const open = (index) => {
    if (index < 0 || index >= usable.length) return false;
    if (!usable[index]) {
      const p = centre(index);
      usable[index] = p.x > 12 && p.x < W - 12 && p.y > 112 && p.y < 726
        && !circleBlocked(p.x, p.y, g.r + 1, walls) ? 1 : -1;
    }
    return usable[index] === 1;
  };
  const nearestCell = (p) => {
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(p.x / cell)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(p.y / cell)));
    let best = -1;
    let distance = Infinity;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (cx + dx < 0 || cx + dx >= cols || cy + dy < 0 || cy + dy >= rows) continue;
        const index = (cy + dy) * cols + cx + dx;
        if (!open(index)) continue;
        const q = centre(index);
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < distance && !losBlocked(p.x, p.y, q.x, q.y, walls)) {
          best = index;
          distance = d;
        }
      }
    }
    return best;
  };
  const start = nearestCell(g);
  const end = nearestCell(goal);
  if (start < 0 || end < 0) return [];
  const previous = new Int32Array(cols * rows).fill(-1);
  const queue = [start];
  previous[start] = start;
  for (let head = 0; head < queue.length && previous[end] < 0; head++) {
    const here = queue[head];
    const x = here % cols;
    const neighbours = [here - cols, here + cols];
    if (x > 0) neighbours.push(here - 1);
    if (x < cols - 1) neighbours.push(here + 1);
    for (const next of neighbours) {
      if (!open(next) || previous[next] >= 0) continue;
      previous[next] = here;
      queue.push(next);
    }
  }
  if (previous[end] < 0) return [];
  const route = [];
  for (let at = end; at !== start; at = previous[at]) route.push(centre(at));
  route.reverse();
  route.push({ ...goal });
  return route;
}

function walk(g, target, speed, dt, walls) {
  const padded = walls.map((r) => ({ x: r.x - g.r, y: r.y - g.r, w: r.w + g.r * 2, h: r.h + g.r * 2 }));
  let aim = target;
  g.routeT -= dt;
  if (losBlocked(g.x, g.y, target.x, target.y, padded)) {
    if (g.routeT <= 0 || !g.route.length) {
      g.route = findRoute(g, target, walls);
      g.routeT = 0.55;
    }
    while (g.route.length && Math.hypot(g.route[0].x - g.x, g.route[0].y - g.y) < 5) g.route.shift();
    aim = g.route[0] || target;
  } else {
    g.route.length = 0;
  }
  const dx = aim.x - g.x;
  const dy = aim.y - g.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 1) {
    turn(g, Math.atan2(dy, dx), dt);
    const step = Math.min(distance, speed * dt);
    moveCircle(g, dx / distance * step, dy / distance * step, walls);
  }
  return Math.hypot(target.x - g.x, target.y - g.y) < 6;
}

function hear(g, noise, walls) {
  if (!noise || g.state === 'chase' || g.heardNoises.has(noise.id)) return;
  if (Math.hypot(noise.x - g.x, noise.y - g.y) > noise.r) return;
  if (losBlocked(g.x, g.y, noise.x, noise.y, walls)) return;
  g.heardNoises.add(noise.id);
  if (g.heardNoises.size > 32) g.heardNoises.delete(g.heardNoises.values().next().value);
  g.state = 'suspicious';
  g.target = { x: noise.x, y: noise.y };
  g.suspiciousT = 2.7;
  g.reactT = 0.45;
  g.routeT = 0;
}

export function updateGuard(g, dt, ctx) {
  const p = ctx.player;
  const walls = ctx.walls;
  g.caughtPlayer = false;
  g.seesPlayer = p.invisibleT <= 0
    && inCone(g.x, g.y, g.angle, g.halfAngle, g.range, p.x, p.y, walls);
  hear(g, ctx.noise || p.noise, walls);
  hear(g, ctx.activeDecoy, walls);

  if (g.seesPlayer) {
    const angle = Math.abs(angleDelta(g.angle, Math.atan2(p.y - g.y, p.x - g.x)));
    const central = angle < g.halfAngle * 0.68 && Math.hypot(p.x - g.x, p.y - g.y) < g.range * 0.88;
    g.notice = Math.min(1, g.notice + dt * (central ? NOTICE_CLEAR_RATE : NOTICE_EDGE_RATE) * (p.sneaking ? 0.72 : 1));
    ctx.alarm.sight(dt, GUARD_DETECTION * (central ? 1 : 0.55));
    g.lastSeen = { x: p.x, y: p.y };
    g.lostT = 0;
    if (g.notice >= 1) {
      g.state = 'chase';
    } else if (g.state !== 'chase' && g.notice >= 0.14) {
      g.state = 'suspicious';
      g.target = { ...g.lastSeen };
      g.suspiciousT = 1.9;
    }
  } else {
    g.notice = Math.max(0, g.notice - dt * 0.4);
    g.lostT += dt;
  }

  const speedUp = ctx.alarm.tripped ? LOCKDOWN_SPEED : 1;
  if (g.state === 'patrol') {
    const [x, y] = g.waypoints[g.waypoint];
    if (g.wait > 0) {
      g.wait -= dt;
      turn(g, Math.atan2(y - g.y, x - g.x), dt, 1.6);
    } else if (walk(g, { x, y }, GUARD_SPEED * speedUp, dt, walls)) {
      g.waypoint = (g.waypoint + 1) % g.waypoints.length;
      g.wait = g.pause;
    }
  } else if (g.state === 'suspicious') {
    g.suspiciousT -= dt;
    g.reactT = Math.max(0, g.reactT - dt);
    turn(g, Math.atan2(g.target.y - g.y, g.target.x - g.x), dt, 2.2);
    if (g.reactT <= 0 && !g.seesPlayer) walk(g, g.target, GUARD_SPEED * 0.62 * speedUp, dt, walls);
    if (g.suspiciousT <= 0 && !g.seesPlayer) {
      g.state = 'search';
      g.searchT = 3.3;
      g.searchAngle = g.angle;
    }
  } else if (g.state === 'chase') {
    walk(g, g.lastSeen, CHASE_SPEED * speedUp, dt, walls);
    if (Math.hypot(p.x - g.x, p.y - g.y) < g.r + p.r - 2
      && !losBlocked(g.x, g.y, p.x, p.y, walls)) g.caughtPlayer = true;
    if (!g.seesPlayer && g.lostT > 2.2) {
      g.state = 'search';
      g.searchT = 4.2;
      g.searchAngle = g.angle;
      g.target = { ...g.lastSeen };
    }
  } else if (g.state === 'search') {
    g.searchT -= dt;
    if (Math.hypot(g.x - g.target.x, g.y - g.target.y) > 12 && g.searchT > 2.5) {
      walk(g, g.target, GUARD_SPEED * 0.8 * speedUp, dt, walls);
    } else {
      turn(g, g.searchAngle + Math.sin(g.searchT * 1.9) * 1.15, dt, 1.8);
    }
    if (g.searchT <= 0) {
      let nearest = 0;
      g.waypoints.forEach(([x, y], index) => {
        const [bx, by] = g.waypoints[nearest];
        if (Math.hypot(g.x - x, g.y - y) < Math.hypot(g.x - bx, g.y - by)) nearest = index;
      });
      g.waypoint = nearest;
      g.state = 'patrol';
      g.wait = 0.45;
      g.routeT = 0;
    }
  }
}
