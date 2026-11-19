// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CardVersionSwitch,
  MoveCardsForm,
  selectionState,
} from "@/app/(platform)/admin/cartes/forms";

vi.mock("@app/ui", () => ({
  cx: (...parts: unknown[]) => parts.filter(Boolean).join(" "),
  Button: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: object) => <input {...props} />,
  Label: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Select: ({ children, ...props }: { children: ReactNode }) => (
    <select {...props}>{children}</select>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(platform)/admin/cartes/actions", () => ({
  createSetAction: vi.fn(),
  moveCardsAction: vi.fn(),
  placeCardAction: vi.fn(),
  stageCardAction: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = (name: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === name) as
    HTMLButtonElement | undefined;

describe("bascule normale / full art sous une carte", () => {
  it("montre la version choisie sur place, et grise celle que la carte n'a pas", () => {
    act(() =>
      root.render(
        <CardVersionSwitch
          cardName="Dragon"
          initial="normal"
          versions={[
            { id: "normal", label: "Normale", face: <p>carte normale</p> },
            { id: "fullart", label: "Full art", face: <p>carte full art</p> },
          ]}
        />,
      ),
    );
    expect(container.textContent).toContain("carte normale");
    expect(button("Normale")?.getAttribute("aria-pressed")).toBe("true");
    act(() => button("Full art")?.click());
    expect(container.textContent).toContain("carte full art");
    expect(container.textContent).not.toContain("carte normale");
    expect(button("Full art")?.getAttribute("aria-pressed")).toBe("true");

    act(() =>
      root.render(
        <CardVersionSwitch
          key="seule"
          cardName="Gobelin"
          initial="fullart"
          versions={[
            { id: "normal", label: "Normale", face: <p>gobelin normal</p> },
            { id: "fullart", label: "Full art", face: null },
          ]}
        />,
      ),
    );
    // La version de la carte manque : la planche montre l'autre, le bouton manquant est grisé.
    expect(container.textContent).toContain("gobelin normal");
    expect(button("Full art")?.disabled).toBe(true);
    expect(button("Normale")?.disabled).toBe(false);
  });
});

describe("« Tout cocher » des cartes affichées", () => {
  it("compte les cases cochées : toutes, une partie, aucune", () => {
    expect(selectionState([])).toBe("none");
    expect(selectionState([{ checked: false }, { checked: false }])).toBe("none");
    expect(selectionState([{ checked: true }, { checked: false }])).toBe("some");
    expect(selectionState([{ checked: true }, { checked: true }])).toBe("all");
  });

  it("coche et décoche toutes les cartes de la planche, et suit les cases cochées à la main", () => {
    act(() =>
      root.render(
        <MoveCardsForm targets={[{ id: "", label: "Réserve" }]} hint="">
          {["a", "b", "c"].map((id) => (
            <input key={id} type="checkbox" name="ids" value={id} aria-label={id} />
          ))}
        </MoveCardsForm>,
      ),
    );
    const all = [...container.querySelectorAll("label")]
      .find((l) => l.textContent?.includes("Tout cocher"))
      ?.querySelector("input") as HTMLInputElement;
    const boxes = [...container.querySelectorAll<HTMLInputElement>('input[name="ids"]')];
    expect(all.checked).toBe(false);

    act(() => all.click());
    expect(boxes.every((b) => b.checked)).toBe(true);

    act(() => boxes[1]?.click());
    expect(all.checked).toBe(false);
    expect(all.indeterminate).toBe(true);

    act(() => all.click());
    expect(boxes.every((b) => b.checked)).toBe(true);
    act(() => all.click());
    expect(boxes.some((b) => b.checked)).toBe(false);
  });
});
