// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMorpionSound } from "../../../games/morpion/ui/sound";

vi.mock("@app/ui", () => ({
  effectiveVolume: () => 0.4,
  isTimeStopped: () => false,
  onVolumeChange: () => () => {},
}));
class FakeAudio {
  static instances: FakeAudio[] = [];
  static rejectNext = false;
  loop = false;
  volume = 1;
  onended: (() => void) | null = null;
  play = vi.fn(async () => {
    if (FakeAudio.rejectNext) {
      FakeAudio.rejectNext = false;
      throw new Error("autoplay interdit");
    }
  });
  pause = vi.fn();
  constructor(readonly src: string) {
    FakeAudio.instances.push(this);
  }
}
function Harness() {
  const sound = useMorpionSound("mario");
  return <button onClick={sound.toggle}>{sound.enabled ? "on" : "off"}</button>;
}
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.rejectNext = false;
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const render = () => act(async () => root.render(<Harness />));
it("active les sons et démarre la musique avec le volume global dès l’ouverture", async () => {
  await render();
  expect(container.textContent).toBe("on");
  expect(FakeAudio.instances[0]).toMatchObject({
    src: "/morpion-assets/mario/main_theme.mp3",
    loop: true,
  });
  expect(FakeAudio.instances[0]?.volume).toBeCloseTo(0.18);
  expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce();
});
it("réessaie au premier geste quand le navigateur bloque l’autoplay", async () => {
  FakeAudio.rejectNext = true;
  await render();
  await act(async () => document.dispatchEvent(new Event("pointerdown")));
  expect(FakeAudio.instances[0]?.play).toHaveBeenCalledTimes(2);
  await act(async () => document.dispatchEvent(new Event("keydown")));
  expect(FakeAudio.instances[0]?.play).toHaveBeenCalledTimes(2);
});
it("respecte la coupure manuelle même quand l’autoplay attend encore un geste", async () => {
  FakeAudio.rejectNext = true;
  await render();
  await act(async () => container.querySelector("button")?.click());
  expect(container.textContent).toBe("off");
  await act(async () => document.dispatchEvent(new Event("pointerdown")));
  expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce();
  expect(FakeAudio.instances[0]?.pause).toHaveBeenCalled();
});
