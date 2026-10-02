import React, { useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Breadcrumbs from "./Breadcrumbs";

export default function Layout({ lowStockAlerts }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Top anchor ref for scroll-to-top feature
  const scrollTopRef = useRef(null);

  // Listen to window scroll to show/hide the scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollToTop = () => {
    scrollTopRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Top scroll anchor */}
      <div ref={scrollTopRef} id="top-anchor" style={{ position: "absolute", top: 0, left: 0 }} />

      {/* Sticky Navbar */}
      <Navbar
        lowStockAlerts={lowStockAlerts}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <div className="app-wrapper">
        {/* Sticky Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className={`main-content ${isSidebarCollapsed ? "collapsed" : ""}`} id="main-content-layout">
          {/* Breadcrumb Navigation */}
          <Breadcrumbs />

          {/* Page contents */}
          <div style={{ flexGrow: 1 }}><Outlet /></div>
        </main>
      </div>

      {/* Scroll to Top button using useRef */}
      {showScrollTop && (
        <button
          className="scroll-top-btn"
          onClick={handleScrollToTop}
          id="scroll-to-top-btn"
          title="Scroll to Top"
          aria-label="Scroll to Top"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  );
}
