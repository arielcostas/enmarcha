import React, { createContext, useContext, useEffect, useState } from "react";

interface PageTitleContextProps {
  title: string;
  setTitle: (title: string) => void;
  titleNode?: React.ReactNode;
  onBack?: () => void;
  backTo?: string;
  setOnBack: (callback?: () => void) => void;
  setBackTo: (to?: string) => void;
  setTitleNode: (node?: React.ReactNode) => void;
}

const PageTitleContext = createContext<PageTitleContextProps | undefined>(
  undefined
);

export const PageTitleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [title, setTitle] = useState("EnMarcha");
  const [titleNode, setTitleNodeState] = useState<React.ReactNode | undefined>(
    undefined
  );
  const [onBack, setOnBackState] = useState<(() => void) | undefined>(
    undefined
  );
  const [backTo, setBackToState] = useState<string | undefined>(undefined);

  const setOnBack = (callback?: () => void) => {
    setOnBackState(() => callback);
  };

  const setBackTo = (to?: string) => {
    setBackToState(to);
  };

  const setTitleNode = (node?: React.ReactNode) => {
    setTitleNodeState(node);
  };

  return (
    <PageTitleContext.Provider
      value={{
        title,
        setTitle,
        titleNode,
        onBack,
        backTo,
        setOnBack,
        setBackTo,
        setTitleNode,
      }}
    >
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

    return () => {};
  }, [title, setTitle]);
};

export const useBackButton = (options?: {
  onBack?: () => void;
  to?: string;
}) => {
  const { setOnBack, setBackTo } = usePageTitleContext();

  useEffect(() => {
    setOnBack(options?.onBack);
    setBackTo(options?.to);

    return () => {
      setOnBack(undefined);
      setBackTo(undefined);
    };
  }, [options?.onBack, options?.to, setOnBack, setBackTo]);
};

export const usePageTitleNode = (node?: React.ReactNode) => {
  const { setTitleNode } = usePageTitleContext();

  useEffect(() => {
    setTitleNode(node);

    return () => {
      setTitleNode(undefined);
    };
  }, [node, setTitleNode]);
};
