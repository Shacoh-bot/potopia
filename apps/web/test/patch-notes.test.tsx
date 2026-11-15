// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PatchNotes } from "@/components/PatchNotes";
import { LATEST_PATCH_NOTE, PATCH_NOTES, parsePatchNotes } from "@/content/patch-notes";

vi.mock("@app/ui", () => ({
  cx: (...parts: unknown[]) => parts.filter(Boolean).join(" "),
}));

describe("données des patch notes", () => {
  it("se chargent, de la plus récente à la plus ancienne, une entrée par jour", () => {
    expect(PATCH_NOTES.length).toBeGreaterThan(0);
    const dates = PATCH_NOTES.map((n) => n.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(new Set(dates).size).toBe(dates.length);
    expect(LATEST_PATCH_NOTE).toBe(dates[0]);
  });

  it("restent lisibles par les membres : ni numéro de PR, ni mention", () => {
    for (const note of PATCH_NOTES) {
      for (const text of [note.title, ...note.items]) {
        expect(text, text).not.toMatch(/#\d+|@\w/);
      }
    }
  });

  it("rangent les entrées et refusent une date mal écrite, une entrée vide ou un jour en double", () => {
    const sorted = parsePatchNotes([
      { date: "2026-11-01", title: "Avant", items: ["a"] },
      { date: "2026-11-03", title: "Après", items: ["b"] },
    ]);
    expect(sorted.map((n) => n.title)).toEqual(["Après", "Avant"]);
    expect(() => parsePatchNotes([{ date: "14/11/2026", title: "x", items: ["a"] }])).toThrow();
    expect(() => parsePatchNotes([{ date: "2026-11-14", title: "x", items: [] }])).toThrow();
    expect(() => parsePatchNotes([])).toThrow();
    expect(() =>
      parsePatchNotes([
        { date: "2026-11-14", title: "x", items: ["a"] },
        { date: "2026-11-14", title: "y", items: ["b"] },
      ]),
    ).toThrow("Deux entrées le 2026-11-14");
  });
});

describe("bouton des nouveautés", () => {
  const notes = [
    { date: "2026-11-14", title: "Récente", items: ["Un truc nouveau."] },
    { date: "2026-11-13", title: "Ancienne", items: ["Un truc plus vieux."] },
  ];
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = () => act(() => root.render(<PatchNotes notes={notes} latest="2026-11-14" />));
  const button = () => host.querySelector("button") as HTMLButtonElement;
  const dot = () => host.querySelector("[data-patch-notes-dot]");

  it("garde la pastille tant que la dernière n'est pas lue, puis s'en souvient", () => {
    render();
    expect(dot()).not.toBeNull();
    act(() => button().click());
    const panel = host.querySelector('[role="dialog"]');
    expect(panel?.textContent).toContain("Récente");
    // la plus récente en haut
    expect(panel?.querySelector("h3")?.textContent).toBe("Récente");
    expect(dot()).toBeNull();
    expect(localStorage.getItem("potopia-patch-notes-vu")).toBe("2026-11-14");

    // rechargement : plus de pastille
    act(() => root.unmount());
    root = createRoot(host);
    render();
    expect(dot()).toBeNull();
  });

  it("revient pour une nouvelle mise à jour", () => {
    localStorage.setItem("potopia-patch-notes-vu", "2026-11-13");
    render();
    expect(dot()).not.toBeNull();
  });

  it("se ferme avec Échap", () => {
    render();
    act(() => button().click());
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
});
