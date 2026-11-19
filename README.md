# Neon Harbor

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/robertcaniago7/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/robertcaniago7/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game built for make.fun's [Make GTA 6](https://make.fun/bounty/gta6-01) bounty. No Rockstar content, no GTA assets — every street, character, car, line of dialogue and sound is made for this game.

## The game

You are **Juno Voss**, a getaway driver in **Neon Harbor**, a sun-soaked port city that never sleeps. You owe **Madame Kestrel** one last favour, and the **Rust Vultures** want the harbour for themselves.

- **Explore on foot and by car** — six districts (Old Town, Downtown, Marina, The Yards, Midtown, Harbor), traffic, pedestrians, parks and docks.
- **Steal and drive** — six original car models plus police interceptors. Jack a car (F) and the driver runs; the law notices.
- **Wanted level** — five stars. Harbor PD interceptors chase and ram you; foot officers join at three stars and will arrest you up close. Lay low and the heat fades, or clear it at the garage.
- **Six story missions** — fares, a stolen coupe, a dockside fight, a hot package, a warehouse payback, and one last getaway to Kestrel's boat.
- **Combat** — fists and the HK-9 pistol, gang shootouts, exploding cars, health/armor/ammo pickups.
- **Side work** — drive a Neon Taxi and fares pay out on delivery; cash pickups on the sidewalks.
- **HUD + minimap** — cash, health, armor, weapon, speed, wanted stars, mission objective with an edge arrow and a live minimap.
- **Save** — progress autosaves to localStorage; continue with C on the title screen.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse + click | Aim and shoot |
| F | Enter / leave a car |
| E | Punch |
| Enter | Start the next mission |
| Shift | Sprint |
| Space | Brake (in a car) |
| P / Esc | Pause |
| M | Mute |

## Play it

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests — every file the game loads lives under `game/`.

## Layout

- `game/index.html` — the page and canvas
- `game/src/` — the game's own source, one job per file: `config`, `random`, `audio`, `city`, `vehicles`, `peds`, `combat`, `missions`, `player`, `world`, `render`, `input`, `save`, `shots`, `main`
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — real renders of the running game (the first by name is the cover)
