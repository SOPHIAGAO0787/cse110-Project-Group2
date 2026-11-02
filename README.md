# Geometry Tower Defense

A tower defense game that teaches geometry, built by CSE 110 Group 2 with TypeScript, Vite, and Konva.

## How to play

1. Click **Play Map 1** on the menu.
2. Drag a tower from the shop onto a green tile, then press **Enter**.
3. Answer the geometry question. A correct answer places the tower and spends its coins.
4. Click **Start Wave** to send enemies down the path, and stop them before they reach the end. (Enemy waves are still being built.)

The menu also has a **Tower Shop** screen that shows each tower's cost and stats.

## Getting started

```sh
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Scripts

- `npm run dev`: start the dev server
- `npm test`: run the unit tests (Vitest)
- `npm run test:watch`: re-run the tests as you edit
- `npm run build`: type-check and build to `dist/`
- `npm run format`: format all files with Prettier
- `npm run preview`: serve the production build

CI runs the type check, the format check, and the tests on every push and pull request.

## Where things live

```
src/
  main.ts           starts the App
  app/              App (owns the stage, switches screens) and screen types
  core/             EventBus (game events) and GameLoop (calls tick every frame)
  model/            game rules and state: plain TypeScript, no Konva, unit tested
    types.ts        shared shapes and the list of game events
    GameModel.ts    holds everything for one game and runs each tick in order
    questions/      picks and checks geometry questions
  data/             maps, towers, enemies, questions (JSON)
  screens/          Menu and Result screens
    game/           the game screen: view, controller, grid, question popup
    shop/           the Tower Shop screen
  ui/               tile-to-pixel helpers and the tower placement preview
```

Rules of thumb:

- **A number or a decision goes in `model/`. A pixel goes in `screens/`.** Model code never imports Konva, so it can be tested without a browser.
- **Positions in the model are in tiles**, not pixels. `(3, 2)` is the center of the tile in column 3, row 2. Views multiply by `TILE`.
- **Parts talk through events.** For example, an enemy dying emits `enemyKilled`, and the wallet listens for it. In tests, emit the event yourself instead of waiting for another part to be finished.

Unfinished work is marked with `TODO(<task id>)` comments, and `WIRE(<task id>)` comments in `GameScreenController.ts` mark where it connects to the game screen.

## Contributing

1. Pick an issue on the project board, or create a sub-issue under its user story.
2. `git switch main && git pull`, then `git switch -c feat/<short-name>`.
3. Write tests for the new behavior and make them pass (`npm test`).
4. Open a pull request, fill in the template with `Closes #<issue>`, add the user story's label, and ask a teammate to review.
5. Merge with a merge commit after one approval and green CI.
