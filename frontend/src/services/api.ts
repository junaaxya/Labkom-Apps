const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (() => {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
})();

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentPath.startsWith("/login")) return;
  clearAuthSession();
  window.location.replace("/login");
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" })) as {
      message?: string;
      errors?: Array<{ field?: string; message?: string } | string | { message?: string }>;
    };

    if (response.status === 401) {
      redirectToLogin();
      return new Promise<T>(() => {});
    }

    const firstFieldError = Array.isArray(error.errors)
      ? error.errors
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && typeof item.message === "string") {
              return item.message;
            }
            return "";
          })
          .find((msg) => msg.length > 0)
      : undefined;

    throw new Error(firstFieldError || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: "POST", body }),
  put: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: "PUT", body }),
  patch: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: "PATCH", body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};

export default api;
