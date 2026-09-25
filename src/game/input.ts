export interface InputFrame {
  left: boolean;
  right: boolean;
  soft: boolean;
  hard: boolean;
  rotCW: boolean;
  rotCCW: boolean;
  hold: boolean;
  pause: boolean;
  start: boolean;
  restart: boolean;
  mute: boolean;
}

const EMPTY: InputFrame = {
  left: false,
  right: false,
  soft: false,
  hard: false,
  rotCW: false,
  rotCCW: false,
  hold: false,
  pause: false,
  start: false,
  restart: false,
  mute: false,
};

const CODES = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "Space",
  "KeyA",
  "KeyD",
  "KeyS",
  "KeyW",
  "KeyZ",
  "KeyX",
  "KeyC",
  "KeyQ",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "Escape",
  "KeyP",
  "Enter",
  "KeyR",
  "KeyM",
]);

export class Input {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private virtualHeld = new Set<string>();
  private virtualPressed = new Set<string>();
  private pulses = { left: 0, right: 0, rot: 0, hard: 0, hold: 0 };

  gesture(kind: "left" | "right" | "rot" | "hard" | "hold") {
    this.pulses[kind] += 1;
  }

  constructor() {
    window.addEventListener("keydown", (event) => {
      if (CODES.has(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (!CODES.has(event.code)) return;
      this.held.add(event.code);
      this.pressed.add(event.code);
    });
    window.addEventListener("keyup", (event) => {
      this.held.delete(event.code);
    });
    window.addEventListener("blur", () => {
      this.held.clear();
      this.virtualHeld.clear();
    });
  }

  pressVirtual(code: string) {
    if (!this.virtualHeld.has(code)) this.virtualPressed.add(code);
    this.virtualHeld.add(code);
  }

  releaseVirtual(code: string) {
    this.virtualHeld.delete(code);
  }

  releaseAllVirtual() {
    this.virtualHeld.clear();
  }

  consume(): InputFrame {
    const down = (code: string) => this.held.has(code) || this.virtualHeld.has(code);
    const hit = (code: string) => this.pressed.has(code) || this.virtualPressed.has(code);

    const frame: InputFrame = {
      left: down("ArrowLeft") || down("KeyA") || this.pulses.left > 0,
      right: down("ArrowRight") || down("KeyD") || this.pulses.right > 0,
      soft: down("ArrowDown") || down("KeyS"),
      hard: hit("Space") || this.pulses.hard > 0,
      rotCW: hit("ArrowUp") || hit("KeyW") || hit("KeyX") || this.pulses.rot > 0,
      rotCCW: hit("KeyZ") || hit("KeyQ") || hit("ControlLeft") || hit("ControlRight"),
      hold: hit("KeyC") || hit("ShiftLeft") || hit("ShiftRight") || this.pulses.hold > 0,
      pause: hit("Escape") || hit("KeyP"),
      start: hit("Enter") || hit("Space"),
      restart: hit("KeyR"),
      mute: hit("KeyM"),
    };

    this.pressed.clear();
    this.virtualPressed.clear();
    this.pulses.left = 0;
    this.pulses.right = 0;
    this.pulses.rot = 0;
    this.pulses.hard = 0;
    this.pulses.hold = 0;
    return frame;
  }
}

export function blankFrame(): InputFrame {
  return { ...EMPTY };
}
