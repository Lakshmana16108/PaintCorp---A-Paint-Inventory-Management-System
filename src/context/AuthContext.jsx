import React, { createContext, useState, useEffect } from "react";
import { api } from "../services/api";

// Create AuthContext
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const user = sessionStorage.getItem("current_user");
    return user ? JSON.parse(user) : null;
  });

  // Check if token exists, and if so verify with backend on load
  useEffect(() => {
    const token = sessionStorage.getItem("auth_token");
    if (token && !currentUser) {
      api.get("/api/auth/me")
        .then((result) => {
          if (result.success && result.user) {
            sessionStorage.setItem("current_user", JSON.stringify(result.user));
            setCurrentUser(result.user);
          } else {
            logout();
          }
        })
        .catch(() => {
          logout();
        });
    }
  }, []);

  const login = async (email, password) => {
    try {
      const result = await api.post("/api/auth/login", { email, password });
      if (result.success && result.token) {
        sessionStorage.setItem("auth_token", result.token);
        sessionStorage.setItem("current_user", JSON.stringify(result.user));
        setCurrentUser(result.user);
        return { success: true };
      }
      return { success: false, message: "Invalid response from server." };
    } catch (error) {
      return { success: false, message: error.message || "Login failed." };
    }
  };

  const signup = async (userData) => {
    try {
      const result = await api.post("/api/auth/signup", userData);
      if (result.success) {
        return { success: true };
      }
      return { success: false, message: "Registration failed." };
    } catch (error) {
      return { success: false, message: error.message || "Registration failed." };
    }
  };

  const logout = () => {
    sessionStorage.removeItem("current_user");
    sessionStorage.removeItem("auth_token");
    setCurrentUser(null);
  };

  const updateUser = (updatedData) => {
    if (!currentUser) return { success: false, message: "No active user session." };

    // Update currentUser state and sessionStorage
    const newSession = {
      ...currentUser,
      ...updatedData
    };
    sessionStorage.setItem("current_user", JSON.stringify(newSession));
    setCurrentUser(newSession);
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

