import React, { createContext, useState, useEffect, useCallback } from "react";

// Create ThemeContext
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Restore theme from localStorage, default to 'light' (theme can be 'light', 'dark', or 'system')
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return savedTheme ? savedTheme : "light";
  });

  // Save theme to localStorage and apply theme class to HTML element
  useEffect(() => {
    localStorage.setItem("theme", theme);
    const root = window.document.documentElement;

    const applyTheme = (currentTheme) => {
      let resolvedTheme = currentTheme;
      if (currentTheme === "system") {
        resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      
      if (resolvedTheme === "dark") {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }
    };

    applyTheme(theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  // Memoized Theme Toggle using useCallback
  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => {
      if (prevTheme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark";
      }
      return prevTheme === "light" ? "dark" : "light";
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
