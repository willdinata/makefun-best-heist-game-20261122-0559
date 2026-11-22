export function sceneFromUrl() {
  if (typeof window === 'undefined') return null;
  const scene = new URLSearchParams(window.location.search).get('scene');
  return ['title', 'loadout', 'play', 'alarm', 'getaway'].includes(scene) ? scene : null;
}

function placeGuard(g, x, y, angle, state = 'patrol', notice = 0) {
  Object.assign(g, {
    x, y, angle, state, notice,
    target: { x, y }, lastSeen: { x, y }, route: [], wait: 0,
    suspiciousT: 2.4, searchT: 3.5, searchAngle: angle,
  });
}

// Compositions hold still until a play input. UI and synth controls remain live.
export function stageScene(S, scene) {
  if (!scene) return;
  if (scene === 'title' || scene === 'loadout') {
    S.screen = scene;
    return;
  }
  S.screen = scene === 'getaway' ? 'getaway' : 'playing';
  S.staged = scene === 'play' || scene === 'alarm';
  S.time = scene === 'alarm' ? 96.8 : 72.4;
  S.alarm.value = scene === 'alarm' ? 85 : 45;
  S.alarm.maxValue = S.alarm.value;
  S.alarm.everSeen = true;
  S.alarm.tripped = false;
  S.alarm.lockdownT = 0;
  S.player.x = scene === 'alarm' ? 819 : 578;
  S.player.y = scene === 'alarm' ? 440 : 553;
  S.player.angle = scene === 'alarm' ? -1.4 : -0.34;
  S.player.previousX = S.player.x;
  S.player.previousY = S.player.y;
  for (const l of S.level.loot) l.taken = ['coast', 'hour', 'orrery'].includes(l.id);
  S.player.lootValue = 3500;
  S.player.lootCount = 3;
  S.player.speedFactor = 0.965;
  placeGuard(S.guards[0], 255, 438, -2.1);
  placeGuard(S.guards[1], 706, 535, 2.87, 'patrol', 0.43);
  placeGuard(S.guards[2], 941, 367, 1.7);
  S.guards[1].seesPlayer = true;
  S.guards[1].lastSeen = { x: S.player.x, y: S.player.y };
  S.cameras[0].angle = -2.05;
  S.cameras[1].angle = 2.3;
  S.cameras[2].angle = 0.54;
  if (scene === 'alarm') {
    placeGuard(S.guards[1], 695, 462, 2.6, 'search', 0.2);
    placeGuard(S.guards[2], 970, 432, 3.02, 'suspicious', 0.79);
    S.guards[2].target = { x: S.player.x, y: S.player.y };
    S.guards[2].lastSeen = { ...S.guards[2].target };
    S.guards[2].seesPlayer = true;
    S.toast = 'Spotted in the east gallery · break line of sight';
    S.toastT = 100;
  }
  if (scene === 'getaway') {
    S.time = 138.4;
    S.alarm.value = 0;
    S.alarm.maxValue = 47;
    S.player.hasDiamond = true;
    S.player.lootValue = 19300;
    S.player.lootCount = 9;
    S.player.x = 576;
    S.player.y = 704;
    for (const l of S.level.loot) l.taken = !['saffron', 'nocturne'].includes(l.id);
    S.score = {
      loot: 19300, timeBonus: 2540, ghost: 2500, phantom: 0, unspent: S.credits,
      total: 24340 + S.credits, stars: 4, rank: 'Midnight professional',
    };
  }
}
