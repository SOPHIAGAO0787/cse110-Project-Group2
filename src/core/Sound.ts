// The sound effects that play() accepts. Each one is a file in public/audio.
export type EffectName =
  | "wave"
  | "pop"
  | "leak"
  | "place"
  | "win"
  | "lose"
  | "fire-circle"
  | "fire-triangle"
  | "fire-square"
  | "correct"
  | "wrong"
  | "upgrade"
  | "no-coins";

const EFFECT_NAMES: EffectName[] = [
  "wave",
  "pop",
  "leak",
  "place",
  "win",
  "lose",
  "fire-circle",
  "fire-triangle",
  "fire-square",
  "correct",
  "wrong",
  "upgrade",
  "no-coins",
];

// Many enemies can die, and many towers of one kind can fire, at almost the same moment.
// Two of these effects closer together than their gap play once. Each effect keeps its own
// gap, so a circle shot never holds back a triangle shot.
const FIRE_GAP_MS = 200;
const MIN_GAP_MS: { [name: string]: number } = {
  pop: 80,
  "fire-circle": FIRE_GAP_MS,
  "fire-triangle": FIRE_GAP_MS,
  "fire-square": FIRE_GAP_MS,
};

// Shots are heard all the time, so they are quieter than the other effects (which play at 1).
const SHOT_VOLUME = 0.3;
const EFFECT_VOLUME: { [name: string]: number } = {
  "fire-circle": SHOT_VOLUME,
  "fire-triangle": SHOT_VOLUME,
  "fire-square": SHOT_VOLUME,
};

// Plays the music and the sound effects, and remembers whether each one is switched on.
//
//   sound.startMusic();     // the looping music
//   sound.play("pop");      // one short effect
//   sound.toggleEffects();  // the Sound switch in the settings
export class Sound {
  musicOn = true;
  effectsOn = true;
  private music: HTMLAudioElement;
  private effects: { [name: string]: HTMLAudioElement } = {};
  private lastPlayedAt: { [name: string]: number } = {}; // when each effect last played, in ms
  // Called after the Music or Sound switch changes. The App uses it to save the settings.
  onChange: () => void = () => {};

  constructor() {
    // No leading "/": the files load from next to the page, which also works on GitHub Pages
    this.music = new Audio("audio/music.mp3");
    this.music.loop = true;
    this.music.volume = 0.4; // quieter than the effects
    for (const name of EFFECT_NAMES) {
      const effect = new Audio("audio/" + name + ".mp3");
      effect.volume = EFFECT_VOLUME[name] ?? 1;
      this.effects[name] = effect;
    }
  }

  // Browsers block sound until the player's first click, so the App calls this on that click.
  startMusic(): void {
    if (this.musicOn) {
      this.start(this.music);
    }
  }

  toggleMusic(): void {
    this.musicOn = !this.musicOn;
    if (this.musicOn) {
      this.start(this.music);
    } else {
      this.music.pause();
    }
    this.onChange();
  }

  toggleEffects(): void {
    this.effectsOn = !this.effectsOn;
    this.onChange();
  }

  play(name: EffectName): void {
    if (!this.effectsOn) {
      return;
    }
    const gap = MIN_GAP_MS[name];
    if (gap !== undefined) {
      const now = Date.now();
      const last = this.lastPlayedAt[name];
      if (last !== undefined && now - last < gap) {
        return;
      }
      this.lastPlayedAt[name] = now;
    }
    const effect = this.effects[name];
    effect.currentTime = 0; // start over if this effect is still playing
    this.start(effect);
  }

  private start(audio: HTMLAudioElement): void {
    // play() fails when the browser blocks sound or the file is missing.
    // The game then goes on without that sound.
    audio.play().catch(() => {});
  }
}
