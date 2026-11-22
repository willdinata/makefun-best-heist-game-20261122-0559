const EPS = 0.00001;

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
  const cross = (x1, y1, x2, y2) => x1 * y2 - y1 * x2;
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const den = cross(rx, ry, sx, sy);
  const qx = cx - ax;
  const qy = cy - ay;
  if (Math.abs(den) < EPS) {
    if (Math.abs(cross(qx, qy, rx, ry)) > EPS) return false;
    return Math.max(Math.min(ax, bx), Math.min(cx, dx)) <= Math.min(Math.max(ax, bx), Math.max(cx, dx)) + EPS
      && Math.max(Math.min(ay, by), Math.min(cy, dy)) <= Math.min(Math.max(ay, by), Math.max(cy, dy)) + EPS;
  }
  const t = cross(qx, qy, sx, sy) / den;
  const u = cross(qx, qy, rx, ry) / den;
  return t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS;
}

function inside(x, y, r) {
  return x > r.x + EPS && x < r.x + r.w - EPS && y > r.y + EPS && y < r.y + r.h - EPS;
}

export function losBlocked(x1, y1, x2, y2, walls) {
  for (const r of walls) {
    if (inside(x1, y1, r) || inside(x2, y2, r)) return true;
    const right = r.x + r.w;
    const bottom = r.y + r.h;
    if (Math.max(x1, x2) < r.x || Math.min(x1, x2) > right
      || Math.max(y1, y2) < r.y || Math.min(y1, y2) > bottom) continue;
    if (segHit(x1, y1, x2, y2, r.x, r.y, right, r.y)
      || segHit(x1, y1, x2, y2, right, r.y, right, bottom)
      || segHit(x1, y1, x2, y2, right, bottom, r.x, bottom)
      || segHit(x1, y1, x2, y2, r.x, bottom, r.x, r.y)) return true;
  }
  return false;
}

export function inCone(ox, oy, facing, halfAngle, range, px, py, walls) {
  const dx = px - ox;
  const dy = py - oy;
  if (dx * dx + dy * dy > range * range) return false;
  if (Math.abs(angleDelta(facing, Math.atan2(dy, dx))) > halfAngle) return false;
  return !losBlocked(ox, oy, px, py, walls);
}

// Rays and sight checks use the same walls, so a painted cone cannot see through a wall.
export function rayEnd(ox, oy, angle, range, walls) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let nearest = range;
  for (const r of walls) {
    const tx1 = Math.abs(dx) < EPS ? -Infinity : (r.x - ox) / dx;
    const tx2 = Math.abs(dx) < EPS ? Infinity : (r.x + r.w - ox) / dx;
    const ty1 = Math.abs(dy) < EPS ? -Infinity : (r.y - oy) / dy;
    const ty2 = Math.abs(dy) < EPS ? Infinity : (r.y + r.h - oy) / dy;
    if (Math.abs(dx) < EPS && (ox < r.x || ox > r.x + r.w)) continue;
    if (Math.abs(dy) < EPS && (oy < r.y || oy > r.y + r.h)) continue;
    const entry = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2));
    const exit = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));
    if (entry <= exit && exit >= 0 && entry >= 0) nearest = Math.min(nearest, entry);
  }
  return { x: ox + dx * nearest, y: oy + dy * nearest };
}

export function circleBlocked(x, y, radius, walls) {
  return walls.some((r) => {
    const dx = x - clamp(x, r.x, r.x + r.w);
    const dy = y - clamp(y, r.y, r.y + r.h);
    return dx * dx + dy * dy < radius * radius - EPS;
  });
}

export function moveCircle(body, dx, dy, walls) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(3, body.r / 2)));
  for (let i = 0; i < steps; i++) {
    if (!circleBlocked(body.x + dx / steps, body.y, body.r, walls)) body.x += dx / steps;
    if (!circleBlocked(body.x, body.y + dy / steps, body.r, walls)) body.y += dy / steps;
  }
}

export function segmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}
