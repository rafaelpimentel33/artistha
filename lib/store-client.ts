export async function storeRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "";
    throw new Error(error || "Não foi possível concluir. Tente novamente.");
  }
  return data as T;
}

export function sendJson<T>(path: string, body: unknown) {
  return storeRequest<T>(path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
