import { useState, useEffect, useCallback } from 'react';
import { RouterProvider, useAppRouter } from './context/RouterContext';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { Header } from './components/common/Header';
import { PageNavigator } from './components/navigation/PageNavigator';
import { PageRouter } from './components/navigation/PageRouter';
import { SearchSimulationModal } from './components/interactive/SearchSimulationModal';
import { ToastContainer } from './components/common/ToastContainer';
import { CommandPalette } from './components/common/CommandPalette';
import { AppShell } from './components/layout/AppShell';
import { primaryProfile } from './data/mockData';

function AppInner() {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const { navigate, currentPage, currentPath } = useAppRouter();
  const { setLastSearchResult, pushToast, isAuthenticated } = useAppData();

  // Sync browser tab title with active page
  useEffect(() => {
    document.title = `${currentPage.shortTitle} · IPRS Kenya`;
  }, [currentPage, currentPath]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      // ⌘K / Ctrl+K — command palette
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((v) => !v);
        return;
      }
      // ⌘/ — open live verification
      if (meta && e.key === '/') {
        e.preventDefault();
        setIsSearchModalOpen(true);
        return;
      }
      // Escape closes overlays
      if (e.key === 'Escape') {
        setIsCommandOpen(false);
        setIsSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isAuthenticated && window.location.hash !== '#/login') {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handleVerificationComplete = useCallback(() => {
    setIsSearchModalOpen(false);
    setLastSearchResult({
      query: primaryProfile.idNumber,
      profile: primaryProfile,
      timestamp: new Date().toISOString(),
      riskScore: primaryProfile.riskScore,
    });
    pushToast({
      title: 'Verification complete',
      description: `${primaryProfile.fullName} — Risk ${primaryProfile.riskScore}%`,
      type: 'success',
    });
    navigate('/identity-profile');
  }, [setLastSearchResult, pushToast, navigate]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#050b14] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <Header
        onOpenLiveSearch={() => setIsSearchModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandOpen(true)}
      />

      {/* Secondary page chips (desktop) */}
      <div className="hidden md:block">
        <PageNavigator />
      </div>

      {/* Shell with sidebar + page content */}
      <AppShell onOpenCommandPalette={() => setIsCommandOpen(true)}>
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto animate-page-enter">
          <PageRouter />
        </main>
      </AppShell>

      {/* Live Verification Simulator */}
      <SearchSimulationModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onViewProfile={handleVerificationComplete}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onOpenLiveSearch={() => {
          setIsCommandOpen(false);
          setIsSearchModalOpen(true);
        }}
      />

      {/* Toast stack */}
      <ToastContainer />
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
