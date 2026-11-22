import { CAMERA_HALF_ANGLE, CAMERA_RANGE } from './config.js';
import { inCone } from './vision.js';

export function makeCamera(def) {
  return {
    ...def,
    angle: def.base,
    range: def.range || CAMERA_RANGE,
    halfAngle: CAMERA_HALF_ANGLE,
    clock: 0,
    disabled: false,
    disabledT: 0,
    seesPlayer: false,
    player: null,
    walls: [],
  };
}

export function updateCamera(c, dt, empT) {
  c.clock += dt;
  c.angle = c.base + Math.sin(c.clock * 0.62) * c.sweep;
  c.disabled = empT > 0;
  c.disabledT = Math.max(0, empT);
  c.seesPlayer = !c.disabled && !!c.player && c.player.invisibleT <= 0
    && inCone(c.x, c.y, c.angle, c.halfAngle, c.range, c.player.x, c.player.y, c.walls);
}
