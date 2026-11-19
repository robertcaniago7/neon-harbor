# Neon Harbor

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/robertcaniago7/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/robertcaniago7/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01)

An original **3D** open-world crime game built for make.fun's [Make GTA 6](https://make.fun/bounty/gta6-01) bounty. No Rockstar content, no GTA assets — every street, character, car, line of dialogue and sound is made for this game.

## The game

You are **Juno Voss**, a getaway driver in **Neon Harbor**, a sun-soaked port city that never sleeps. You owe **Madame Kestrel** one last favour, and the **Rust Vultures** want the harbour for themselves.

- **A 3D city** — six districts (Old Town, Downtown, Marina, The Yards, Midtown, Harbor), a beach and a sea to the south, palms, piers, neon signs, and a full day/night cycle: bright days, golden-hour dusk, magenta-cyan neon nights.
- **Third-person on foot and by car** — walk, sprint, punch, shoot; steal any parked car (F) and drive it with arcade physics (three.js + cannon-es RaycastVehicle).
- **Wanted level** — five stars. Harbor PD interceptors chase along the road graph and ram you; foot officers join at three stars and will arrest you up close. Lay low and the heat fades — or change to an unseen car or outfit and the cops lose the trail.
- **Six story missions** — a first fare, a stolen coupe, a dockside fight, a hot package, a warehouse payback, and one last getaway to Kestrel's boat at the pier.
- **Combat** — fists and the HK-9 pistol, gang shootouts with tracers, health/armor/ammo/cash pickups.
- **HUD + minimap** — cash, health, armor, weapon, speed, wanted stars, mission objective, a live 2D minimap, and a waypoint beacon you can see across the city.
- **Save** — progress autosaves to localStorage; continue from the title screen.
- **Touch controls** — virtual joystick plus SHOOT / CAR / HIT / JOB buttons on phones.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse drag | Look around (third-person camera) |
| Mouse click / hold | Aim and shoot (pistol) |
| F | Enter / exit a car (steal a parked car) |
| E | Punch |
| Enter | Start the next story job |
| Shift | Sprint |
| Space | Brake (in a car) |
| 1 / 2 | Fists / pistol |
| P / Esc | Pause |
| M | Mute |

## Play it

Serve `game/` with any static server and open `index.html` in a desktop or mobile browser:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests — every file the game loads lives under `game/`.

## How it's built

- **three.js r180** (pinned) for rendering: merged/instanced geometry, one directional shadow, fog, capped pixel ratio — the whole city renders in well under 100 draw calls.
- **cannon-es** RaycastVehicle for the player's car only; traffic, pedestrians and police are kinematic waypoint followers on a road graph (no extra physics bodies).
- **nipplejs** for the touch joystick.
- All three libraries are vendored as `*.min.js` under `game/vendor/`; all sound is synthesized with WebAudio (no audio files, no licensed music).
- `game/src/` — the game's own source, one job per file: `config`, `random`, `merge`, `city`, `vehicle3d`, `character`, `physics`, `input`, `daynight`, `traffic`, `police`, `combat`, `missions`, `hud`, `audio`, `save`, `shots`, `world`, `main`.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — real renders of the running game (the first by name is the cover). Each one is staged with `?shot=<name>&seed=1` (see `shots.json`).

## Screenshots

1. **cover** — golden-hour downtown, Juno in a Sunset Cruiser with Harbor PD closing in.
2. **city** — afternoon on the beach road, looking north at the Downtown skyline.
3. **mission** — dusk at the docks, Vultures holding the corner.
4. **combat** — night in The Yards, pistol out.
