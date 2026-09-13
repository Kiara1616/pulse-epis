const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error ?? body?.detail;
    const code = typeof error?.code === "string" ? error.code : "API_ERROR";
    const message = typeof error?.message === "string" ? error.message : "La API no pudo completar la operación.";
    throw new ApiError(response.status, code, message);
  }
  return body as T;
}
