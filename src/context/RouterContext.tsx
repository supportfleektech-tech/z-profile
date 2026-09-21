import React, { createContext, useContext, useState, useEffect } from 'react';
import { platformRoutes, PageRoute } from '../types/routes';

interface RouterContextType {
  currentPath: string;
  currentPage: PageRoute;
  navigate: (pathOrId: string) => void;
  goBack: () => void;
  historyStack: string[];
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read initial route from URL hash if available (e.g., #/dashboard), fallback to '/dashboard'
  const getPathFromHash = (): string => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || hash === '/' || hash === '') return '/dashboard';
    return hash;
  };

  const [currentPath, setCurrentPath] = useState<string>(getPathFromHash);
  const [historyStack, setHistoryStack] = useState<string[]>([getPathFromHash()]);

  // Sync with browser hash changes (browser back/forward button)
  useEffect(() => {
    const handleHashChange = () => {
      const newPath = getPathFromHash();
      setCurrentPath(newPath);
      setHistoryStack((prev) => {
        if (prev[prev.length - 1] === newPath) return prev;
        return [...prev, newPath];
      });
    };

    window.addEventListener('hashchange', handleHashChange);
    // Ensure initial hash is set for deep-link shareability
    if (!window.location.hash) {
      window.location.hash = getPathFromHash();
    }
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (pathOrId: string) => {
    let resolvedPath = pathOrId;

    // Check if ID was passed instead of path
    const matchById = platformRoutes.find((r) => r.id === pathOrId);
    if (matchById) {
      resolvedPath = matchById.path;
    } else if (!resolvedPath.startsWith('/')) {
      resolvedPath = `/${resolvedPath}`;
    }

    if (resolvedPath !== currentPath) {
      window.location.hash = resolvedPath;
      setCurrentPath(resolvedPath);
      setHistoryStack((prev) => [...prev, resolvedPath]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goBack = () => {
    if (historyStack.length > 1) {
      const nextStack = [...historyStack];
      nextStack.pop(); // remove current
      const prevPath = nextStack[nextStack.length - 1];
      setHistoryStack(nextStack);
      window.location.hash = prevPath;
      setCurrentPath(prevPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/dashboard');
    }
  };

  const currentPage =
    platformRoutes.find((r) => r.path === currentPath) ||
    platformRoutes.find((r) => r.id === 'dashboard') ||
    platformRoutes[1];

  return (
    <RouterContext.Provider
      value={{
        currentPath,
        currentPage,
        navigate,
        goBack,
        historyStack,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export const useAppRouter = (): RouterContextType => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useAppRouter must be used within a RouterProvider');
  }
  return context;
};
