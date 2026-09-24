import { useState, useEffect, useCallback } from 'react';
import { RouterProvider, useAppRouter } from './context/RouterContext';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { Header } from './components/common/Header';
import { PageRouter } from './components/navigation/PageRouter';
import { SearchSimulationModal } from './components/interactive/SearchSimulationModal';
import { ToastContainer } from './components/common/ToastContainer';
import { CommandPalette } from './components/common/CommandPalette';
import { AppShell } from './components/layout/AppShell';
import { PrintReport } from './components/report/PrintReport';

function AppInner() {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const { navigate, currentPage, currentPath } = useAppRouter();
  const { isAuthenticated, can, activeDossier, settings } = useAppData();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    document.title = `${currentPage.shortTitle} · IPRS Kenya`;
  }, [currentPage, currentPath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((v) => !v);
        return;
      }
      if (meta && e.key === '/') {
        e.preventDefault();
        if (can('search.run')) setIsSearchModalOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        setIsCommandOpen(false);
        setIsSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [can]);

  useEffect(() => {
    if (authChecked) {
      if (!isAuthenticated && currentPath !== '/login') navigate('/login');
      if (isAuthenticated && currentPath === '/login') navigate('/dashboard');
    } else {
      setAuthChecked(true);
    }
  }, [isAuthenticated, currentPath, navigate, authChecked]);

  const handleVerificationComplete = useCallback(() => {
    setIsSearchModalOpen(false);
    navigate('/identity-profile');
  }, [navigate]);

  const onLogin = currentPath === '/login' || !isAuthenticated;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#050b14] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {!onLogin && (
        <Header onOpenLiveSearch={() => setIsSearchModalOpen(true)} onOpenCommandPalette={() => setIsCommandOpen(true)} />
      )}

      {onLogin ? (
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto animate-page-enter">
          <PageRouter />
        </main>
      ) : (
        <AppShell onOpenCommandPalette={() => setIsCommandOpen(true)}>
          <main className="flex-1 flex flex-col min-h-0 overflow-y-auto animate-page-enter">
            <PageRouter />
          </main>
        </AppShell>
      )}

      <SearchSimulationModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} onViewProfile={handleVerificationComplete} />
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onOpenLiveSearch={() => {
          setIsCommandOpen(false);
          setIsSearchModalOpen(true);
        }}
      />
      <ToastContainer />
      {/* Print-only, full-dataset rendering of the active dossier (hidden on screen). */}
      <PrintReport dossier={activeDossier} settings={settings} />
    </div>
  );
}

export function App() {
  return (
    <RouterProvider>
      <AppDataProvider>
        <AppInner />
      </AppDataProvider>
    </RouterProvider>
  );
}

export default App;
