import { ArrowLeft, Menu } from "lucide-react";
import { Link } from "react-router";
import { usePageTitleContext } from "~/contexts/PageTitleContext";
import "./Header.css";

interface HeaderProps {
  title?: string;
  onMenuClick?: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = "Enmarcha",
  onMenuClick,
  className = "",
}) => {
  const { onBack, backTo, titleNode } = usePageTitleContext();

  return (
    <header className={`app-header ${className}`}>
      <div className="app-header__left">
        {backTo && (
          <Link
            className="app-header__menu-btn"
            to={backTo}
            aria-label="Atrás"
            style={{ marginRight: "8px" }}
          >
            <ArrowLeft size={24} />
          </Link>
        )}
        {!backTo && onBack && (
          <button
            className="app-header__menu-btn"
            onClick={onBack}
            aria-label="Atrás"
            style={{ marginRight: "8px" }}
          >
            <ArrowLeft size={24} />
          </button>
        )}
        {titleNode ? titleNode : <h1 className="app-header__title">{title}</h1>}
      </div>
      <div className="app-header__right">
        <button
          className="app-header__menu-btn"
          onClick={onMenuClick}
          aria-label="Menu"
        >
          <Menu size={24} />
        </button>
      </div>
    </header>
  );
};
