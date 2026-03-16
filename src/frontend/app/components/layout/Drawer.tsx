import { Info, Settings, Shield, Star, X } from "lucide-react";
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import "./Drawer.css";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const location = useLocation();

  // Close drawer when route changes
  useEffect(() => {
    onClose();
  }, [location.pathname]);

  return (
    <>
      <div
        className={`drawer-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`drawer ${isOpen ? "open" : ""}`}>
        <div className="drawer__header">
          <h2 className="drawer__title">Menu</h2>
          <button className="drawer__close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <nav className="drawer__nav">
          <Link to="/favourites" className="drawer__link">
            <Star size={20} />
            <span>{t("navbar.favourites", "Favoritos")}</span>
          </Link>
          <Link to="/settings" className="drawer__link">
            <Settings size={20} />
            <span>{t("navbar.settings", "Ajustes")}</span>
          </Link>
          <Link to="/about" className="drawer__link">
            <Info size={20} />
            <span>{t("about.title", "Acerca de")}</span>
          </Link>
          <Link to="/politica-privacidad" className="drawer__link">
            <Shield size={20} />
            <span>{t("navbar.privacy", "Privacidad")}</span>
          </Link>
        </nav>
      </div>
    </>
  );
};
