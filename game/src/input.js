import { W, H } from './config.js';

export const keysDown = new Set();
export const keysPressed = new Set();
export const mouse = { x: W / 2, y: H / 2, clicked: false, down: false, inside: false };

const pendingKeys = new Set();
let pendingClick = false;
let pendingClickPosition = null;

export function initInput(canvas) {
  const gameKeys = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'ShiftLeft', 'ShiftRight', 'KeyE', 'Digit1', 'Digit2', 'Digit3', 'KeyM', 'KeyR',
    'KeyP', 'Escape', 'Enter', 'Space', 'Tab',
  ]);
  const position = (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * W / rect.width;
    mouse.y = (event.clientY - rect.top) * H / rect.height;
    mouse.inside = mouse.x >= 0 && mouse.x <= W && mouse.y >= 0 && mouse.y <= H;
  };
  window.addEventListener('keydown', (event) => {
    if (gameKeys.has(event.code)) event.preventDefault();
    if (!keysDown.has(event.code) && !event.repeat) pendingKeys.add(event.code);
    keysDown.add(event.code);
  });
  window.addEventListener('keyup', (event) => keysDown.delete(event.code));
  window.addEventListener('blur', () => {
    keysDown.clear();
    keysPressed.clear();
    pendingKeys.clear();
    pendingClick = false;
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', position);
  canvas.addEventListener('pointerleave', () => { mouse.inside = false; });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    position(event);
    pendingClick = true;
    pendingClickPosition = { x: mouse.x, y: mouse.y };
    mouse.down = true;
    canvas.focus({ preventScroll: true });
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

// Events stay queued until a simulation step, even on a high-refresh-rate display.
export function update() {
  for (const key of pendingKeys) keysPressed.add(key);
  pendingKeys.clear();
  mouse.clicked = pendingClick;
  if (pendingClick && pendingClickPosition) Object.assign(mouse, pendingClickPosition);
  pendingClick = false;
  pendingClickPosition = null;
}

export function endFrame() {
  keysPressed.clear();
  mouse.clicked = false;
}
