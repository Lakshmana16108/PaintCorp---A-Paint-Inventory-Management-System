/**
 * Clean environment-based API base URL configuration:
 * - In production: defaults to "" (same-origin relative requests e.g. /api/...) when frontend & backend are co-deployed on Vercel.
 *   If a custom remote VITE_API_URL is explicitly set and valid (not pointing to localhost or obsolete URLs), it will be used.
 * - In development: defaults to "http://localhost:5000" unless overridden by VITE_API_URL.
 */
export function resolveApiUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || "").trim();
  if (import.meta.env.PROD) {
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1") && !envUrl.includes("onrender.com")) {
      return envUrl.replace(/\/+$/, "");
    }
    return "";
  }
  return envUrl ? envUrl.replace(/\/+$/, "") : "http://localhost:5000";
}

export const API_URL = resolveApiUrl();

export function getGoogleAuthUrl() {
  return `${API_URL}/api/auth/google`;
}


/**
 * Helper to get authorization headers with JWT.
 */
function getHeaders() {
  const headers = {
    "Content-Type": "application/json"
  };
  const token = sessionStorage.getItem("auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Handle API responses and throw detailed errors.
 */
async function handleResponse(response) {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorMsg = (data && data.error) || (data && data.message) || response.statusText || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * API client module using native fetch.
 */
export const api = {
  async get(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "GET",
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async post(endpoint, body) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(response);
  },

  async put(endpoint, body) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return handleResponse(response);
  },

  async delete(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    return handleResponse(response);
  },

  async sendCorpAIMessage(message, conversationHistory = []) {
    return this.post("/api/ai/chat", { message, conversationHistory });
  }
};

