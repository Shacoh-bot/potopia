/** Pose refusée : message affiché tel quel au joueur, `status` pour la réponse HTTP. */
export class PoseError extends Error {
  constructor(
    readonly status: 400 | 409,
    message: string,
  ) {
    super(message);
    this.name = "PoseError";
  }
}
