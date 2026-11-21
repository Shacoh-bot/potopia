// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeCardAction } from "@/app/(platform)/admin/cartes/actions";
import {
  CardVersionSwitch,
  MoveCardsForm,
  PlaceSelect,
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
        <MoveCardsForm targets={[{ id: "", label: "Réserve" }]} hint="" candidates={[]}>
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

/** Change la valeur d'un champ comme le fait le navigateur, pour que React voie l'événement. */
function change(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(el, value);
  el.dispatchEvent(
    new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
  );
}

describe("« Doublon » : choisir la carte d'origine dans une liste", () => {
  const candidates = [
    { id: "rat", name: "Le Rat Géant", place: "S1", thumb: "/rat.webp" },
    { id: "sage", name: "Le vieux sage", place: "Réserve", thumb: null },
    { id: "copie", name: "Copie du rat", place: "S1", thumb: null },
  ];

  it("ne range rien avant le choix, cherche par nom (sans accents) et envoie la carte choisie", async () => {
    vi.mocked(placeCardAction).mockResolvedValue(null);
    act(() =>
      root.render(
        <PlaceSelect
          cardId="copie"
          cardName="Copie du rat"
          value="reserve"
          targets={[
            { id: "reserve", label: "Réserve" },
            { id: "duplicate", label: "Doublon" },
          ]}
          candidates={candidates}
        />,
      ),
    );
    act(() => change(container.querySelector("select") as HTMLSelectElement, "duplicate"));
    expect(placeCardAction).not.toHaveBeenCalled();
    const options = () =>
      [...container.querySelectorAll('[role="option"]')].map((o) => o.textContent);
    // la carte elle-même n'est pas proposée
    expect(options()).toEqual(["Le Rat GéantS1", "Le vieux sageRéserve"]);
    expect(container.querySelector('[role="option"] img')?.getAttribute("src")).toBe("/rat.webp");

    act(() => change(container.querySelector("input") as HTMLInputElement, "geant"));
    expect(options()).toEqual(["Le Rat GéantS1"]);
    await act(async () =>
      (container.querySelector('[role="option"]') as HTMLButtonElement).click(),
    );
    expect(placeCardAction).toHaveBeenCalledWith("copie", "duplicate", "rat");
    expect(container.querySelector('[role="option"]')).toBeNull();
  });

  it("dans la planche, le doublon attend sa carte d'origine avant « Valider »", () => {
    act(() =>
      root.render(
        <MoveCardsForm
          targets={[{ id: "duplicate", label: "Doublon" }]}
          hint=""
          candidates={candidates}
        >
          <input type="checkbox" name="ids" value="copie" aria-label="copie" />
        </MoveCardsForm>,
      ),
    );
    act(() => change(container.querySelector("select") as HTMLSelectElement, "duplicate"));
    expect(button("Valider")?.disabled).toBe(true);
    act(() => (container.querySelector('[role="option"]') as HTMLButtonElement).click());
    expect(container.textContent).toContain("Doublon de : Le Rat Géant");
    const form = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).get("duplicateOf")).toBe("rat");
    expect(button("Valider")?.disabled).toBe(false);
  });
});
