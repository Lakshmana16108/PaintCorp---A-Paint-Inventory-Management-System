const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = rawApiUrl.replace(/\/+$/, "");

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
    const errorMsg = (data && data.error) || (data && data.message) || response.statusText;
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
  }
};
