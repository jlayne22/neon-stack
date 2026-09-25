import type { GameEvent } from "./types";

const STORAGE_KEY = "neon-stack-muted";

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // file:// and locked-down browsers may refuse storage; sound still toggles in memory.
  }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted: boolean;

  constructor() {
    this.muted = readFlag(STORAGE_KEY);
  }

  toggle() {
    this.muted = !this.muted;
    writeFlag(STORAGE_KEY, this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
  }

  unlock() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
  }

  consume(events: GameEvent[]) {
    if (this.muted) return;
    for (const event of events) {
      switch (event.type) {
        case "move":
          this.blip(520, 0.035, "sine", 0.12);
          break;
        case "rotate":
          this.slide(640, 920, 0.07, "triangle", 0.14);
          break;
        case "hold":
          this.slide(480, 720, 0.09, "sine", 0.12);
          break;
        case "lock":
          this.noise(0.07, 900, 0.18);
          this.blip(150, 0.08, "sine", 0.16);
          break;
        case "hard-drop":
          this.noise(0.09, 420, 0.28);
          this.blip(90, 0.12, "sine", 0.22);
          break;
        case "clear":
          this.clear(event.lines, event.perfect);
          break;
        case "level":
          this.level();
          break;
        case "over":
          this.over();
          break;
        default:
          break;
      }
    }
  }

  ui() {
    this.blip(740, 0.05, "sine", 0.1);
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.32;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    }
    return this.ctx;
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(amp).connect(this.master as GainNode);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private slide(from: number, to: number, dur: number, type: OscillatorType, gain: number) {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(amp).connect(this.master as GainNode);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, freq: number, gain: number) {
    const ctx = this.ensure();
    const count = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, count, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    const amp = ctx.createGain();
    const t = ctx.currentTime;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(amp).connect(this.master as GainNode);
    src.start(t);
  }

  private clear(lines: number, perfect: boolean) {
    const notes = [523, 659, 784, 1046, 1318];
    const count = perfect ? 5 : Math.min(4, lines);
    for (let i = 0; i < count; i++) {
      const ctx = this.ensure();
      const t = ctx.currentTime + i * 0.055;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = lines >= 4 || perfect ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(notes[i], t);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(amp).connect(this.master as GainNode);
      osc.start(t);
      osc.stop(t + 0.24);
    }
    if (lines >= 4 || perfect) this.noise(0.18, 1800, 0.12);
  }

  private level() {
    [523, 659, 880, 1174].forEach((freq, i) => {
      const ctx = this.ensure();
      const t = ctx.currentTime + i * 0.07;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(0.1, t + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(amp).connect(this.master as GainNode);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  private over() {
    [440, 349, 262, 196].forEach((freq, i) => {
      const ctx = this.ensure();
      const t = ctx.currentTime + i * 0.12;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.22);
      amp.gain.setValueAtTime(0.12, t);
      amp.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(amp).connect(this.master as GainNode);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}
