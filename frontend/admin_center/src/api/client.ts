export type RequestOptions = {
  token?: string | null;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

export async function apiClient(
  input: string,
  { token, method = "GET", headers, body }: RequestOptions = {},
): Promise<Response> {
  const finalHeaders: Record<string, string> = {
    ...(headers || {}),
  };
  if (body && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }
  return fetch(input, {
    method,
    headers: finalHeaders,
    body,
    credentials: "include",
  });
}
