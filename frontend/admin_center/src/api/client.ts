export type RequestOptions = {
  token?: string | null;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  skipAuth?: boolean;
};

export async function apiClient(
  input: string,
  { token, method = "GET", headers, body, skipAuth = false }: RequestOptions = {},
): Promise<Response> {
  const finalHeaders: Record<string, string> = {
    ...(headers || {}),
  };
  if (body && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }
  if (!skipAuth && token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }
  return fetch(input, {
    method,
    headers: finalHeaders,
    body,
    credentials: "include",
  });
}
