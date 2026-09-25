# Neon Stack

A neon glass falling-block puzzle. Stack seven shapes, clear horizontal lines, and chase a local high score. Original game — no third-party falling-block branding.

## Double-click

`NeonStack.html` at the repo root is a self-contained build. Download that one file and open it in a browser (double-click, or `file://`). No install and no dev server.

Rebuild it after source changes:

```bash
npm install
npm run pack
```

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

Logic check (no browser):

```bash
npm run verify
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `←` `→` or `A` `D` | ◀ ▶ |
| Rotate clockwise | `↑` `W` `X` | ↻ |
| Rotate counter-clockwise | `Z` `Q` `Ctrl` | ↺ |
| Soft drop | `↓` or `S` | ▼ |
| Hard drop | `Space` | ⤓ |
| Hold | `C` or `Shift` | H |
| Pause | `Esc` or `P` | II |
| Restart | `R` while paused or after the run ends | — |
| Mute | `M` | Sound toggle on the menu |

On-screen buttons appear for touch devices and narrow windows.

## Play

- 10×20 well, seven-piece bag, five upcoming shapes, hold once per drop.
- Soft drop, hard drop, ghost landing guide, and wall-kick rotations.
- Lines score more at higher levels. Every 10 lines speeds the drop.
- Four-line clears can chain a back-to-back bonus. Consecutive clears build a combo. Emptying the well is a perfect clear.
- High score is stored in `localStorage`.
