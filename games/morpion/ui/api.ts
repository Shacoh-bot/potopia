export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/morpion${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data === "object" && data && "error" in data
        ? String(data.error)
        : "Impossible de joindre le jeu.",
    );
  return data as T;
}
