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
      left: down("ArrowLeft") || down("KeyA"),
      right: down("ArrowRight") || down("KeyD"),
      soft: down("ArrowDown") || down("KeyS"),
      hard: hit("Space"),
      rotCW: hit("ArrowUp") || hit("KeyW") || hit("KeyX"),
      rotCCW: hit("KeyZ") || hit("KeyQ") || hit("ControlLeft") || hit("ControlRight"),
      hold: hit("KeyC") || hit("ShiftLeft") || hit("ShiftRight"),
      pause: hit("Escape") || hit("KeyP"),
      start: hit("Enter") || hit("Space"),
      restart: hit("KeyR"),
      mute: hit("KeyM"),
    };

    this.pressed.clear();
    this.virtualPressed.clear();
    return frame;
  }
}

export function blankFrame(): InputFrame {
  return { ...EMPTY };
}
