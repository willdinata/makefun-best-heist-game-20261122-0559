# MIDNIGHT MERIDIAN
[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/willdinata/makefun-best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/willdinata/makefun-best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)


An original, single-screen, top-down stealth heist through an Art Deco museum after dark. Choose a loadout with 600 credits, steal the Meridian Diamond and whatever else you can carry, then return to the south-entrance van; readable patrols, wall-clipped cones, cycling lasers, and two vent pairs reward careful routes. Play the static files in `game/` in desktop Chrome, offline, with no external assets or online services. Press **Enter** to open the loadout and start; use **↑/↓** to select tools, **←/→** to adjust quantities, or the mouse buttons, and **Space** to toggle lockpicks. **WASD / arrow keys** move, **Shift** sneaks, **E** holds to steal, unlock, or escape (tap it at a vent), **1** fires an EMP, **2** plants a decoy at the mouse, **3** deploys smoke, **M** mutes, **P / Escape** pauses, and **R** returns to a fresh loadout. Extra loot adds weight; fast escapes, low alarms, staying unseen, and unspent credits improve your score.

## Hand-in

Run with Node 22:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The program copies `game/` and the optional `screenshots/` folder, then generates `dossier.json` with the unchanged vendor helper. The helper requires PNG or JPEG screenshots in the output; provide three or four images in `screenshots/`, each under 256 KiB, for the bounty hand-in. Screenshot compositions are available at `game/index.html?scene=title`, `?scene=loadout`, `?scene=play`, `?scene=alarm`, and `?scene=getaway`; the two gameplay scenes hold their composition until a play input.

Built for a make.fun bounty. Referral code: 63p7zf8z
