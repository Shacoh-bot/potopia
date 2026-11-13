import { AGENTS_NAME } from "@app/agents";
import { getUsersByIds, listRecentEvents, MAX_RECENT_EVENTS, type ActivityEvent } from "@app/core";
import type { ActivityItem } from "@app/core/ui";

type Payload = ActivityEvent["payload"];

function field(payload: Payload, key: string): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  return payload[key];
}

function numberField(payload: Payload, key: string): number | undefined {
  const value = field(payload, key);
  return typeof value === "number" ? value : undefined;
}

function stringField(payload: Payload, key: string): string | undefined {
  const value = field(payload, key);
  return typeof value === "string" ? value : undefined;
}

/** Pseudo d'un autre membre cité par l'événement (le partenaire d'une partie à deux). */
type NameOf = (userId: string | undefined) => string | undefined;

/**
 * Phrase affichée pour chaque type d'événement (`app/type`). Les événements ne portent jamais de
 * contenu privé : seulement des compteurs (score d'une partie…).
 */
const DESCRIPTIONS: Record<string, (payload: Payload, nameOf: NameOf) => string> = {
  "agents/mission_completed": (payload, nameOf) => {
    const partner = nameOf(stringField(payload, "partnerId"));
    const turns = numberField(payload, "turns");
    const duo = partner ? ` avec ${partner}` : "";
    if (field(payload, "won") !== true) return `a raté une mission ${AGENTS_NAME}${duo}`;
    return turns && turns > 9
      ? `a réussi une mission ${AGENTS_NAME}${duo} en mort subite 🕵️`
      : `a réussi une mission ${AGENTS_NAME}${duo} en ${turns ?? "?"} tours 🕵️`;
  },
  "avatar/updated": () => "a changé de look",
  "douze/day_completed": (payload) => {
    const points = numberField(payload, "points");
    const day = numberField(payload, "number");
    const title = day && day >= 1 ? `DOUZE #${day}` : "DOUZE";
    if (points === undefined) return `a fini ${title}`;
    if (points === 144) return `a fait 144 sur 144 à ${title} : une grosse 🕛`;
    if (points === 12) return `a fait 12 points pile à ${title}. Douze. Évidemment.`;
    return `a fini ${title} : ${points} / 144`;
  },
  "ideas/idea_submitted": () => "a proposé une idée",
  "pose/day_completed": (payload) => {
    const percent = numberField(payload, "percent");
    const day = numberField(payload, "number");
    const title = day ? `Pose JoJo #${day}` : "Pose JoJo";
    if (percent === undefined) return `a fini ${title}`;
    return percent >= 90
      ? `a pris la pose à ${title} : ${percent} % ゴゴゴ`
      : `a fini ${title} : ${percent} %`;
  },
  "trois/day_completed": (payload) => {
    const found = numberField(payload, "found");
    const day = numberField(payload, "number");
    const title = day ? `TROIS #${day}` : "TROIS";
    if (found === undefined) return `a fini ${title}`;
    return found === 3 ? `a fait 3 sur 3 à ${title} 🏆` : `a fini ${title} : ${found}/3`;
  },
};

/**
 * Exploit mis en avant en or dans le fil : un 3 sur 3 à TROIS, 90 % ou plus à Pose JoJo, 120 points
 * ou plus (ou 12 pile) à DOUZE.
 */
function isFeat(app: string, type: string, payload: Payload): boolean {
  if (type !== "day_completed") return false;
  if (app === "pose") return (numberField(payload, "percent") ?? 0) >= 90;
  if (app === "douze") {
    const points = numberField(payload, "points") ?? 0;
    return points >= 120 || points === 12;
  }
  return app === "trois" && numberField(payload, "found") === 3;
}

export function describeEvent(
  app: string,
  type: string,
  payload: Payload = {},
  nameOf: NameOf = () => undefined,
): string {
  return DESCRIPTIONS[`${app}/${type}`]?.(payload, nameOf) ?? "a été actif sur la plateforme";
}

export async function getActivityFeed(limit = MAX_RECENT_EVENTS): Promise<ActivityItem[]> {
  const events = await listRecentEvents(limit);
  const ids = events.flatMap((e) => {
    const partnerId = stringField(e.payload, "partnerId");
    return partnerId ? [e.userId, partnerId] : [e.userId];
  });
  const users = new Map((await getUsersByIds(ids)).map((u) => [u.id, u]));
  const nameOf: NameOf = (id) => (id ? users.get(id)?.name : undefined);
  return events.map((event) => {
    const user = users.get(event.userId);
    return {
      id: event.id,
      user: user ? { name: user.name, image: user.image } : null,
      text: describeEvent(event.app, event.type, event.payload, nameOf),
      highlight: isFeat(event.app, event.type, event.payload),
      createdAt: event.createdAt,
    };
  });
}
