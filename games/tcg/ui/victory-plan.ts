import { z } from "zod";

/*
 * Préparation de la synchronisation des sons de victoire (page admin), côté navigateur : pur, sans
 * base ni stockage. L'envoi et l'enregistrement passent par `syncVictorySounds` (serveur).
 */

const listFile = z.object({
  sons: z.array(
    z.looseObject({
      id: z.string(),
      titre: z.string(),
      fichier: z.string(),
      ecarte: z.boolean().optional(),
    }),
  ),
});

/** Un son de la liste à synchroniser ; `file` : nom du fichier à envoyer (nouveau ou changé). */
export type VictorySyncItem = { id: string; title: string; file: string | null };

/**
 * Prépare la synchronisation d'un dossier (page admin) : lit `liste.json` (format de Poto-Son :
 * `{ sons: [{ id, titre, fichier, ecarte }] }`), garde les sons NON écartés (`ecarte: false`), dans
 * l'ordre, et dit lesquels envoyer : un son nouveau, ou dont le fichier n'a plus la même taille.
 * `files` : chemins relatifs des fichiers du dossier choisi et leur taille ; `current` : taille des
 * sons déjà enregistrés. Erreur claire si un fichier manque.
 */
export function planVictorySync(
  liste: unknown,
  files: ReadonlyMap<string, number>,
  current: ReadonlyMap<string, number>,
): VictorySyncItem[] {
  const parsed = listFile.safeParse(liste);
  if (!parsed.success) throw new Error("liste.json illisible : { sons: [...] } attendu.");
  const paths = [...files.keys()];
  return parsed.data.sons
    .filter((s) => s.ecarte === false)
    .map((s) => {
      const want = s.fichier.replaceAll("\\", "/").replace(/^\.?\//, "");
      // chemin dans le dossier choisi ; à défaut (fichiers choisis un à un), même nom de fichier
      const name = want.split("/").pop();
      const path =
        paths.find((p) => p === want || p.endsWith(`/${want}`)) ??
        paths.find((p) => p.split("/").pop() === name);
      const known = current.get(s.id);
      if (!path) {
        if (known === undefined) throw new Error(`Fichier ${want} absent du dossier.`);
        return { id: s.id, title: s.titre, file: null };
      }
      return { id: s.id, title: s.titre, file: known === files.get(path) ? null : path };
    });
}
