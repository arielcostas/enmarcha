import { Menu } from "lucide-react";
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
  return (
    <header className={`app-header ${className}`}>
      <div className="app-header__left">
        <h1 className="app-header__title">{title}</h1>
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
