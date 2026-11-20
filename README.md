# Neon Harbor 3D

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/robertcaniago7/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/robertcaniago7/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D open-world crime game for the make.fun **"Make GTA 6"** bounty
(gta6-01). No Rockstar names, maps, characters, or assets — every street,
character, car, line of dialogue and sound is original.

## The game

You are **Juno Voss**, a getaway driver in **Neon Harbor**, a sun-soaked port
city. You owe **Madame Kestrel** one last favour, and the **Rust Vultures** gang
wants the harbour for themselves.

- **A 3D city** — six districts, a beach and a sea to the south, palms, piers,
  neon signs, and a full day/night cycle: bright days, golden-hour dusk,
  magenta-cyan neon nights.
- **Third-person on foot and by car** — walk, sprint, punch, shoot; steal any
  parked car (F) and drive it with arcade physics.
- **Wanted level** — five stars. Police interceptors chase along the road graph
  and ram you; foot officers join at three stars and will arrest you up close.
  Lay low and the heat fades, or change to an unseen car and the cops lose the
  trail.
- **Six story missions** — a first fare, a stolen coupe, a dockside fight, a hot
  package, a warehouse payback, and one last getaway to Kestrel's boat at the pier.
- **Combat** — fists and the HK-9 pistol, gang shootouts with tracers,
  health/armor/ammo/cash pickups.
- **HUD + minimap** — cash, health, armor, weapon, speed, wanted stars, mission
  objective, a live 2D minimap, and a waypoint beacon visible across the city.
- **Save** — progress autosaves to localStorage; continue from the title screen.
- **Touch controls** — virtual joystick plus SHOOT / CAR / HIT / JOB buttons.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move (on foot) / drive (in car) |
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

## How it's built

- **three.js r180** (pinned, vendored) for rendering: merged geometry, one
  directional shadow, fog, capped pixel ratio. The city renders in a few dozen
  draw calls.
- **cannon-es** RaycastVehicle for the player's car only. Traffic, pedestrians
  and police are kinematic waypoint followers on a road graph (no extra physics
  bodies).
- **nipplejs** (vendored) for the touch joystick.
- All sound is synthesized with WebAudio (no audio files, no licensed music).
- No build step, no network requests — every file the game loads lives under
  `game/`.

## Run it

```sh
node serve.ts
# open http://localhost:8080/
```

## Entrypoint

`main.ts` copies `game/` and `screenshots/` to `/output` (or
`$MAKEFUN_OUTPUT_DIR`) and writes `/output/dossier.json` with the vendored
make.fun library (`./vendor/makefun-game.ts`):

```sh
node main.ts
```
