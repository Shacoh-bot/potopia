// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PatchNotes } from "@/components/PatchNotes";
import {
  latestPatchNote,
  notesFor,
  PATCH_NOTES,
  parsePatchNotes,
  type PatchNoteEntry,
} from "@/content/patch-notes";

vi.mock("@app/ui", () => ({
  cx: (...parts: unknown[]) => parts.filter(Boolean).join(" "),
}));

describe("données des patch notes", () => {
  it("se chargent, de la plus récente à la plus ancienne, une entrée par jour", () => {
    expect(PATCH_NOTES.length).toBeGreaterThan(0);
    const dates = PATCH_NOTES.map((n) => n.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("restent lisibles par les membres : ni numéro de PR, ni mention", () => {
    for (const note of notesFor(PATCH_NOTES, true)) {
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
    // une ligne admin s'écrit { text, admin: true }, rien d'autre
    expect(() =>
      parsePatchNotes([{ date: "2026-11-14", title: "x", items: [{ text: "a", admin: false }] }]),
    ).toThrow();
  });
});

describe("nouveautés selon le compte", () => {
  const entries: PatchNoteEntry[] = parsePatchNotes([
    {
      date: "2026-11-14",
      title: "Le Potodex grandit",
      publicTitle: "Petites retouches",
      items: ["Pour tous.", { text: "Détail admin : Potodex.", admin: true }],
    },
    { date: "2026-11-12", title: "Coulisses", items: [{ text: "Booster secret.", admin: true }] },
    { date: "2026-11-10", title: "Ancienne", items: ["Pour tous aussi."] },
  ]);

  it("un admin voit tout, dans l'ordre", () => {
    const notes = notesFor(entries, true);
    expect(notes.map((n) => [n.date, n.title, n.items])).toEqual([
      ["2026-11-14", "Le Potodex grandit", ["Pour tous.", "Détail admin : Potodex."]],
      ["2026-11-12", "Coulisses", ["Booster secret."]],
      ["2026-11-10", "Ancienne", ["Pour tous aussi."]],
    ]);
    expect(latestPatchNote(notes)).toBe("2026-11-14");
  });

  it("un non-admin ne reçoit aucune ligne admin, ni entrée sans ligne pour lui, ni titre admin", () => {
    const notes = notesFor(entries, false);
    expect(notes).toEqual([
      { date: "2026-11-14", title: "Petites retouches", items: ["Pour tous."] },
      { date: "2026-11-10", title: "Ancienne", items: ["Pour tous aussi."] },
    ]);
    // ce qui part vers le navigateur : rien d'admin
    const sent = JSON.stringify(notes);
    for (const secret of ["Détail admin", "Booster secret", "Coulisses", "Potodex"]) {
      expect(sent).not.toContain(secret);
    }
  });

  it("pas de pastille pour une entrée invisible : la dernière visible compte", () => {
    const onlyAdminNews = parsePatchNotes([
      { date: "2026-11-15", title: "Admin", items: [{ text: "Outil admin.", admin: true }] },
      { date: "2026-11-13", title: "Pour tous", items: ["Nouveau jeu."] },
    ]);
    expect(latestPatchNote(notesFor(onlyAdminNews, true))).toBe("2026-11-15");
    expect(latestPatchNote(notesFor(onlyAdminNews, false))).toBe("2026-11-13");
    expect(latestPatchNote([])).toBe("");
  });

  it("contenu réel : aucun détail des cartes pour un non-admin, au plus une ligne vague", () => {
    const sent = JSON.stringify(notesFor(PATCH_NOTES, false)).toLowerCase();
    for (const word of ["booster", "potodex", "sr ou mieux", "look", "full art", "paquet"]) {
      expect(sent, word).not.toContain(word);
    }
    const vague = notesFor(PATCH_NOTES, false)
      .flatMap((n) => n.items)
      .filter((item) => /carte/i.test(item));
    expect(vague).toEqual(["En coulisses, les admins préparent les cartes Potopia."]);
    // l'admin, lui, a le détail
    expect(JSON.stringify(notesFor(PATCH_NOTES, true))).toContain("Potodex");
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
