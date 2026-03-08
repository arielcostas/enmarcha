import React, { createContext, useContext, useEffect, useState } from "react";

interface PageTitleContextProps {
  title: string;
  setTitle: (title: string) => void;
  titleNode?: React.ReactNode;
  rightNode?: React.ReactNode;
  onBack?: () => void;
  backTo?: string;
  setOnBack: (callback?: () => void) => void;
  setBackTo: (to?: string) => void;
  setTitleNode: (node?: React.ReactNode) => void;
  setRightNode: (node?: React.ReactNode) => void;
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
  const [rightNode, setRightNodeState] = useState<React.ReactNode | undefined>(
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
    setTitleNodeState((prev) => (prev === node ? prev : node));
  };

  const setRightNode = (node?: React.ReactNode) => {
    setRightNodeState((prev) => (prev === node ? prev : node));
  };

  return (
    <PageTitleContext.Provider
      value={{
        title,
        setTitle,
        titleNode,
        rightNode,
        onBack,
        backTo,
        setOnBack,
        setBackTo,
        setTitleNode,
        setRightNode,
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
  }, [title]);
};

export const useBackButton = (options?: {
  onBack?: () => void;
  to?: string;
}) => {
  const { setOnBack, setBackTo } = usePageTitleContext();

  const onBack = options?.onBack;
  const to = options?.to;

  useEffect(() => {
    setOnBack(onBack);
    setBackTo(to);

    return () => {
      setOnBack(undefined);
      setBackTo(undefined);
    };
  }, [onBack, to]);
};

export const usePageTitleNode = (node?: React.ReactNode) => {
  const { setTitleNode } = usePageTitleContext();

  useEffect(() => {
    setTitleNode(node);

    return () => {
      setTitleNode(undefined);
    };
  }, []); // Only set on mount/unmount to avoid loops with JSX
};

export const usePageRightNode = (node: React.ReactNode) => {
  const { setRightNode } = usePageTitleContext();

  useEffect(() => {
    setRightNode(node);

    return () => {
      setRightNode(undefined);
    };
  }, []); // Only set on mount/unmount to avoid loops with JSX
};
