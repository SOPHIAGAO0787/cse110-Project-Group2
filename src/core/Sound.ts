// The sound effects that play() accepts. Each one is a file in public/audio.
export type EffectName = "wave" | "pop" | "leak" | "place" | "win" | "lose";

const EFFECT_NAMES: EffectName[] = ["wave", "pop", "leak", "place", "win", "lose"];

// Many enemies can die at almost the same moment. Pops closer together than this play once.
const POP_GAP_MS = 80;

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
  private lastPopAt = 0; // time of the last pop, in milliseconds

  constructor() {
    this.music = new Audio("/audio/music.mp3");
    this.music.loop = true;
    this.music.volume = 0.4; // quieter than the effects
    for (const name of EFFECT_NAMES) {
      this.effects[name] = new Audio("/audio/" + name + ".mp3");
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
  }

  toggleEffects(): void {
    this.effectsOn = !this.effectsOn;
  }

  play(name: EffectName): void {
    if (!this.effectsOn) {
      return;
    }
    if (name === "pop") {
      const now = Date.now();
      if (now - this.lastPopAt < POP_GAP_MS) {
        return;
      }
      this.lastPopAt = now;
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
