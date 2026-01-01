import React, { useState } from "react";
import { Outlet } from "react-router";
import { useEnMarchaAnnouncement } from "~/hooks/useEnMarchaAnnouncement";
import {
  PageTitleProvider,
  usePageTitleContext,
} from "~/contexts/PageTitleContext";
import { EnMarchaAnnouncement } from "../EnMarchaAnnouncement";
import { ThemeColorManager } from "../ThemeColorManager";
import "./AppShell.css";
import { Drawer } from "./Drawer";
import { Header } from "./Header";
import NavBar from "./NavBar";

const AppShellContent: React.FC = () => {
  const { title } = usePageTitleContext();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { isOpen, closeAnnouncement } = useEnMarchaAnnouncement();

  return (
    <div className="app-shell">
      <ThemeColorManager />
      <Header
        className="app-shell__header"
        title={title}
        onMenuClick={() => setIsDrawerOpen(true)}
      />
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      <div className="app-shell__body">
        <main className="app-shell__main">
          <Outlet />
        </main>
      </div>
      <footer className="app-shell__bottom-nav">
        <NavBar />
      </footer>

      <EnMarchaAnnouncement isOpen={isOpen} onClose={closeAnnouncement} />
    </div>
  );
};

export const AppShell: React.FC = () => {
  return (
    <PageTitleProvider>
      <AppShellContent />
    </PageTitleProvider>
  );
};
