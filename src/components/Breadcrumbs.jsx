import React from "react";
import { useLocation, Link } from "react-router-dom";

const pathNames = {
  "dashboard": "Dashboard",
  "paint-list": "Paint List",
  "available-stock": "Available Stock",
  "billing": "Billing",
  "orders": "Orders",
  "profile": "Profile",
  "settings": "Settings"
};

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  return (
    <div className="breadcrumbs" aria-label="breadcrumb">
      <div className="breadcrumb-item">
        <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>Home</Link>
      </div>
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;
        const isLast = index === pathnames.length - 1;
        const displayName = pathNames[value] || value;

        return (
          <React.Fragment key={to}>
            <span className="breadcrumb-separator">/</span>
            <div className="breadcrumb-item">
              {isLast ? (
                <span className="breadcrumb-current">{displayName}</span>
              ) : (
                <Link to={to} style={{ color: "inherit", textDecoration: "none" }}>{displayName}</Link>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
