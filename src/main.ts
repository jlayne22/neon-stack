import { AudioEngine } from "./game/audio";
import { Game } from "./game/game";
import { Input } from "./game/input";
import { Renderer } from "./render/renderer";
import "./style.css";

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}

const canvas = must<HTMLCanvasElement>("#view");
const modal = must<HTMLDivElement>("#modal");
const heading = must<HTMLHeadingElement>("#heading");
const tag = must<HTMLParagraphElement>("#tag");
const primary = must<HTMLButtonElement>("#primary");
const secondary = must<HTMLButtonElement>("#secondary");
const muteBtn = must<HTMLButtonElement>("#mute");
const touch = must<HTMLDivElement>("#touch");
const statA = must<HTMLElement>("#stat-a");
const statB = must<HTMLElement>("#stat-b");
const statC = must<HTMLElement>("#stat-c");
const statALabel = must<HTMLElement>("#stat-a-label");
const statBLabel = must<HTMLElement>("#stat-b-label");
const statCLabel = must<HTMLElement>("#stat-c-label");

const game = new Game();
const input = new Input();
const audio = new AudioEngine();
const renderer = new Renderer(canvas);

const coarse = window.matchMedia("(pointer: coarse)");
function wantsTouch() {
  return coarse.matches || window.innerWidth < 820;
}

function resize() {
  renderer.resize(window.innerWidth, window.innerHeight, wantsTouch());
  touch.hidden = !wantsTouch();
}

window.addEventListener("resize", resize);
coarse.addEventListener("change", resize);
resize();

touch.querySelectorAll<HTMLButtonElement>("button[data-code]").forEach((button) => {
  const code = button.dataset.code ?? "";
  const down = (event: PointerEvent) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    input.pressVirtual(code);
    audio.unlock();
  };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", () => input.releaseVirtual(code));
  button.addEventListener("pointercancel", () => input.releaseVirtual(code));
});

function format(n: number) {
  return n.toLocaleString("en-US");
}

let shownScore = 0;
let scoreTimer = 0;

function syncModal() {
  const snap = game.snapshot();
  muteBtn.textContent = audio.muted ? "Sound off" : "Sound on";
  const open = snap.phase !== "playing";
  modal.hidden = !open;
  if (!open) return;

  if (snap.phase === "menu") {
    heading.innerHTML = "NEON<br />STACK";
    tag.textContent = "Stack the light. Clear the grid.";
    primary.textContent = "Start run";
    secondary.hidden = true;
    statALabel.textContent = "Best";
    statBLabel.textContent = "Queue";
    statCLabel.textContent = "Field";
    statA.textContent = format(snap.highScore);
    statB.textContent = "5";
    statC.textContent = "10×20";
    shownScore = 0;
  } else if (snap.phase === "paused") {
    heading.textContent = "PAUSED";
    tag.textContent = "The stack is holding.";
    primary.textContent = "Resume";
    secondary.hidden = false;
    secondary.textContent = "Restart";
    statALabel.textContent = "Score";
    statBLabel.textContent = "Level";
    statCLabel.textContent = "Lines";
    statA.textContent = format(snap.score);
    statB.textContent = String(snap.level);
    statC.textContent = String(snap.lines);
  } else {
    heading.textContent = "SIGNAL LOST";
    tag.textContent = snap.score >= snap.highScore && snap.score > 0 ? "New high score." : "The well is sealed.";
    primary.textContent = "Play again";
    secondary.hidden = true;
    statALabel.textContent = "Score";
    statBLabel.textContent = "Best";
    statCLabel.textContent = "Lines";
    statB.textContent = format(snap.highScore);
    statC.textContent = String(snap.lines);
  }
}

primary.addEventListener("click", () => {
  audio.unlock();
  audio.ui();
  if (game.phase === "paused") game.togglePause();
  else if (game.phase === "menu") game.start();
  else game.restart();
});

secondary.addEventListener("click", () => {
  audio.unlock();
  audio.ui();
  game.restart();
});

muteBtn.addEventListener("click", () => {
  audio.toggle();
  syncModal();
});

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const frameInput = input.consume();
  if (frameInput.mute) audio.toggle();
  if (frameInput.start || frameInput.pause || frameInput.hard || frameInput.rotCW) audio.unlock();
  game.update(dt, frameInput);
  const events = game.drainEvents();
  audio.consume(events);
  renderer.render(game.snapshot(), events, dt);

  if (game.phase === "over") {
    scoreTimer += dt;
    const target = game.score;
    shownScore += (target - shownScore) * Math.min(1, dt * 4);
    if (Math.abs(target - shownScore) < 1) shownScore = target;
    statA.textContent = format(Math.round(shownScore));
  } else if (scoreTimer !== 0) {
    scoreTimer = 0;
  }

  syncModal();
  requestAnimationFrame(frame);
}

syncModal();
requestAnimationFrame(frame);
