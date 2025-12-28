import React, { createContext, useContext, useEffect, useState } from "react";

interface PageTitleContextProps {
  title: string;
  setTitle: (title: string) => void;
}

const PageTitleContext = createContext<PageTitleContextProps | undefined>(
  undefined
);

export const PageTitleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [title, setTitle] = useState("EnMarcha");

  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
};

export const usePageTitleContext = () => {
  const context = useContext(PageTitleContext);
  if (!context) {
    throw new Error(
      "usePageTitleContext must be used within a PageTitleProvider"
    );
  }
  return context;
};

export const usePageTitle = (title: string) => {
  const { setTitle } = usePageTitleContext();

  useEffect(() => {
    setTitle(title);
    document.title = `${title} - EnMarcha`;

    return () => {
    };
  }, [title, setTitle]);
};
