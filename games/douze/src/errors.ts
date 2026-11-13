/** Épreuve refusée : message affiché tel quel au joueur, `status` pour la réponse HTTP. */
export class DouzeError extends Error {
  constructor(
    readonly status: 400 | 409,
    message: string,
  ) {
    super(message);
    this.name = "DouzeError";
  }
}
