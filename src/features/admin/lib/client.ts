import { toast } from "sonner";

export async function fetchJsonSafe<T>(
  url: string,
  init?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof data === "object" && data && "error" in data
          ? (data as { error: string }).error
          : "Error inesperado.";
      toast.error(msg);
      return null;
    }
    return data as T;
  } catch {
    toast.error("No se pudo contactar con el servidor.");
    return null;
  }
}
