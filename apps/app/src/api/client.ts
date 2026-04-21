import { resolveApiBaseUrl, trimTrailingSlash } from "../utils";

export const API_BASE_URL = resolveApiBaseUrl();

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", token, body } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${trimTrailingSlash(API_BASE_URL)}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      message = data?.message || (Array.isArray(data) ? JSON.stringify(data) : message);
    } catch {
      // use default message
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (email: string, password: string, kind?: "client" | "business") =>
      request<{ token: string; refreshToken: string; user: { id: string; email: string; kind: string; role?: string } }>(
        "/auth/login",
        { method: "POST", body: { email, password, kind } }
      ),
    refresh: (refreshToken: string) =>
      request<{ token: string; refreshToken: string }>("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
      }),
    forgotPassword: (email: string) =>
      request<{ ok: boolean; message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email },
      }),
    oauthExchange: (payload: {
      accessToken?: string;
      idToken?: string;
      provider?: string;
      kind?: string;
      email?: string;
      name?: string;
    }) => request<{ token: string; refreshToken: string; user: { id: string; email: string; kind: string; role?: string } }>(
      "/auth/oauth/exchange",
      { method: "POST", body: payload }
    ),
  },
  users: {
    me: (token: string) =>
      request<{ id: string; email: string; kind: string; role?: string; name?: string; phone?: string; avatarUrl?: string; notifyApp?: boolean; notifyEmail?: boolean; visibility?: boolean }>(
        "/users/me",
        { token }
      ),
    updateMe: (token: string, data: Record<string, unknown>) =>
      request("/users/me", { method: "PATCH", token, body: data }),
    registerClient: (data: { name: string; email: string; password: string }) =>
      request("/users/client", { method: "POST", body: data }),
    registerBusiness: (data: { name: string; email: string; password: string; role?: string }) =>
      request("/users/business", { method: "POST", body: data }),
    activities: (token: string) =>
      request<unknown[]>("/users/activities", { token }),
    createActivity: (token: string, data: Record<string, unknown>) =>
      request("/users/activities", { method: "POST", token, body: data }),
    updateActivity: (token: string, id: string, data: Record<string, unknown>) =>
      request(`/users/activities/${id}`, { method: "PATCH", token, body: data }),
  },
  businesses: {
    list: () => request<unknown[]>("/businesses"),
    mine: (token: string) => request<unknown[]>("/businesses/mine", { token }),
    create: (token: string, data: Record<string, unknown>) =>
      request("/businesses", { method: "POST", token, body: data }),
    update: (token: string, businessId: string, data: Record<string, unknown>) =>
      request(`/businesses/${businessId}`, { method: "PATCH", token, body: data }),
    services: (businessId: string) =>
      request<unknown[]>(`/businesses/${businessId}/services`),
    createService: (token: string, businessId: string, data: Record<string, unknown>) =>
      request(`/businesses/${businessId}/services`, { method: "POST", token, body: data }),
    rules: (token: string, businessId: string) =>
      request<unknown[]>(`/businesses/${businessId}/rules`, { token }),
    setRules: (token: string, businessId: string, data: Record<string, unknown>) =>
      request(`/businesses/${businessId}/rules`, { method: "POST", token, body: data }),
    exceptions: (token: string, businessId: string) =>
      request<unknown[]>(`/businesses/${businessId}/exceptions`, { token }),
    addException: (token: string, businessId: string, data: Record<string, unknown>) =>
      request(`/businesses/${businessId}/exceptions`, { method: "POST", token, body: data }),
    availability: (businessId: string, params: { date: string; serviceId?: string; staffId?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return request<unknown[]>(`/businesses/${businessId}/availability?${qs}`);
    },
  },
  appointments: {
    list: (token: string) => request<unknown[]>("/appointments", { token }),
    create: (token: string, data: Record<string, unknown>) =>
      request("/appointments", { method: "POST", token, body: data }),
    cancel: (token: string, id: string) =>
      request(`/appointments/${id}/cancel`, { method: "POST", token }),
  },
};
