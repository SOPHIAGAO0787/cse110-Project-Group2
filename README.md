# CSE 110 Project — Group 2

Geometry tower defense game built with TypeScript, Vite, and Konva.

## Getting started

```sh
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Scripts

- `npm run dev` — start the dev server
- `npm test` — run the unit tests (Vitest)
- `npm run test:watch` — re-run tests as you edit
- `npm run build` — type-check and build to `dist/`
- `npm run format` — format all files with Prettier
- `npm run preview` — serve the production build

CI runs the type check, the format check, and the tests on every push and pull request.

## Where things live

```
src/
  main.ts                 starts the App
  app/                    App (owns the stage, switches screens) and screen types
  core/                   EventBus (game events) and GameLoop (calls tick every frame)
  model/                  game rules and state: plain TypeScript, no Konva, unit tested
    types.ts              shared shapes and the list of game events (everyone codes against these)
    GameModel.ts          holds everything for one game and runs each tick in order
  data/                   maps, towers, enemies, questions (JSON)
  screens/                Menu, Result, and the Game screen (views + controller)
```

Rules of thumb:

- **A number or a decision goes in `model/`. A pixel goes in `screens/`.** Model code never imports Konva, so it can be tested without a browser.
- **Positions in the model are in tiles**, not pixels. `(3, 2)` is the center of the tile in column 3, row 2. Views multiply by `TILE`.
- **Parts talk through events.** For example, an enemy dying emits `enemyKilled`, and the wallet listens for it. In tests, emit the event yourself instead of waiting for a teammate's code.

## Where to start on your task

Each Sprint 1 task already has a file with `TODO(<task id>)` comments and a test file listing the tests to write (`it.todo`).

| Task                          | Start in                                                                    |
| ----------------------------- | --------------------------------------------------------------------------- |
| B1 Place circle towers        | `GameModel.tryPlaceTower`, `WIRE(B1)` in `GameScreenController.ts`          |
| B2 Range preview              | `WIRE(B2)` in `GameScreenController.ts`                                     |
| R1 Path + movement            | `src/model/Path.ts`, `src/model/Enemy.ts`                                   |
| R2 Enemy HP / death / leaking | `src/model/Enemy.ts`, step 4 in `GameModel.tick`                            |
| R3 Tower targeting            | `src/model/Tower.ts`                                                        |
| N1 Waves + HUD                | `src/model/WaveManager.ts`                                                  |
| N2 Lives                      | `src/model/Lives.ts`                                                        |
| S1 Victory / defeat           | step 5 in `GameModel.tick`, `src/screens/ResultScreen.ts`                   |
| S2 Buy towers                 | `WIRE(S2)` in `GameScreenController.ts`                                     |
| W1 Coins                      | `src/model/Wallet.ts`                                                       |
| W2 Grid                       | `src/model/Grid.ts`                                                         |
| W3 Integration tests          | `src/model/integration.test.ts`                                             |
| J1 Shop cards                 | `shopGroup` in `src/screens/game/GameScreenView.ts`, `src/data/towers.json` |
| J2 "Not enough coins" message | `WIRE(J2)` in `GameScreenController.ts`                                     |
| M1, M2 Questions              | `src/model/questions/QuestionService.ts`, `src/data/questions.json`         |
| M3 Lives in the HUD           | `WIRE(M3)` in `GameScreenController.ts`                                     |

Search for `TODO(` and `WIRE(` to find every spot. `src/model/geometry/CircleRange.ts` is a finished example of a small model class with tests.

## Workflow

1. `git switch main && git pull`, then `git switch -c feat/<task-id>-<short-name>`
2. Write the tests from your `it.todo` list, then make them pass (`npm test`)
3. Open a pull request, fill in the template, add your user story's label, and ask a teammate to review
4. Merge after one approval and green CI
