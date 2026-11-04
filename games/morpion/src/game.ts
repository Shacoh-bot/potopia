export const THEMES = [
  { id: "mario", name: "Super Mario Bros", players: ["Mario · Étoile", "Luigi · Champignon"] },
  { id: "sw", name: "Star Wars", players: ["Luke · Sabres", "Vador · Étoile noire"] },
  { id: "simpson", name: "Les Simpson", players: ["Homer", "M. Burns"] },
  { id: "got", name: "Game of Thrones", players: ["Stark", "Lannister"] },
  { id: "ghibli", name: "Ghibli", players: ["Épouvantail", "Nekobasu"] },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];
export type Player = { id: string; name: string; image: string | null };
export type GameView = {
  id: string;
  players: [Player, Player];
  mySeat: 0 | 1;
  theme: ThemeId;
  board: string;
  status: "WAITING" | "PLAYING" | "WON" | "DRAW" | "ABANDONED";
  turn: number;
  winner: number | null;
  version: number;
  updatedAt: string;
  score: [number, number];
};
export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;
export function winningLine(board: string): readonly number[] | null {
  return (
    LINES.find((line) => line.every((i) => board[i] !== "." && board[i] === board[line[0]])) ?? null
  );
}
export function place(board: string, cell: number, seat: 0 | 1) {
  if (
    !/^[.XO]{9}$/.test(board) ||
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell > 8 ||
    board[cell] !== "."
  )
    throw new Error("Case indisponible.");
  const cells = board.split("");
  cells[cell] = seat === 0 ? "X" : "O";
  const next = cells.join("");
  return {
    board: next,
    status: winningLine(next)
      ? ("WON" as const)
      : next.includes(".")
        ? ("PLAYING" as const)
        : ("DRAW" as const),
  };
}
