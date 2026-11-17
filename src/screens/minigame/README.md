# Geometry minigame — Issue #70

`GeometryMiniGameScreen` implements the existing `Screen` interface. It is intentionally not registered in `App.ts` or the menu; navigation and rewards belong to Issue #71.

## Connecting Issue #71

```ts
const minigame = new GeometryMiniGameScreen(({ correctAnswers, totalQuestions }) => {
  // Issue #71 handles this result and any rewards here.
});
```

Add `minigame.group` to the app's Konva layer, include the screen in resizing, and call `show()` / `hide()` when navigating. Add the screen name and menu entry in Issue #71. No `Progress` instance is required by the minigame.

The callback runs once per completed round, after the player continues past the fifth feedback message. It returns `{ correctAnswers, totalQuestions }`. Restart allows another round and another callback. Leaving an unfinished round does not call it. The callback can leave the results visible or navigate away.

Each round generates five questions: circle area, diameter to radius, rectangle area, triangle area, and supplementary angles. Each question gets 25 seconds of active simulation time using the existing `GameLoop`. Feedback pauses that question's timer until Next Question. Answers use the existing `QuestionService.check()` parser. Circle areas allow rounding to two decimal places; `pi` expressions are also accepted.

## Local preview before menu integration

Run `npm run dev`, open the Vite URL, and paste this into the browser developer console. It mounts a temporary independent preview over the app without changing repository files:

```js
const Konva = (await import("/node_modules/.vite/deps/konva.js")).default;
const { GeometryMiniGameScreen } = await import("/src/screens/minigame/GeometryMiniGameScreen.ts");
const host = document.createElement("div");
host.style.cssText = "position:fixed;inset:0;z-index:9999";
document.body.append(host);
const stage = new Konva.Stage({ container: host, width: innerWidth, height: innerHeight });
const layer = new Konva.Layer();
stage.add(layer);
const screen = new GeometryMiniGameScreen(console.log);
layer.add(screen.group);
screen.resize(innerWidth, innerHeight);
screen.show();
window.closeGeometryPreview = () => {
  screen.hide();
  stage.destroy();
  host.remove();
};
```

Type answers and use Submit or Enter. Check feedback, a 25-second timeout, results after five questions, and Restart. Run `closeGeometryPreview()` to close, or refresh the page. Automated tests exercise simulated time without waiting in real time.
