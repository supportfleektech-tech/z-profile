import React, { useState, Suspense, lazy } from 'react';
import { Maximize2, ExternalLink } from 'lucide-react';
import { SystemArchitecture } from '../footer/SystemArchitecture';
import { KeyFeatures } from '../footer/KeyFeatures';
import { SecurityCompliance } from '../footer/SecurityCompliance';
import { DeploymentCiCd } from '../footer/DeploymentCiCd';
import { BrandFooter } from '../footer/BrandFooter';
import { ScreenModal } from '../interactive/ScreenModal';

const Screen1_Login = lazy(() => import('../screens/Screen1_Login'));
const Screen2_Dashboard = lazy(() => import('../screens/Screen2_Dashboard'));
const Screen3_NewSearch = lazy(() => import('../screens/Screen3_NewSearch'));
const Screen4_IdentityProfile = lazy(() => import('../screens/Screen4_IdentityProfile'));
const Screen5_DetailedReport = lazy(() => import('../screens/Screen5_DetailedReport'));
const Screen6_Cases = lazy(() => import('../screens/Screen6_Cases'));
const Screen7_ReportsAnalytics = lazy(() => import('../screens/Screen7_ReportsAnalytics'));
const Screen8_Billing = lazy(() => import('../screens/Screen8_Billing'));
const Screen9_AdminConsole = lazy(() => import('../screens/Screen9_AdminConsole'));
const Screen10_ProviderManagement = lazy(() => import('../screens/Screen10_ProviderManagement'));
const Screen11_PricingTiers = lazy(() => import('../screens/Screen11_PricingTiers'));
const Screen12_ApiDocumentation = lazy(() => import('../screens/Screen12_ApiDocumentation'));
const Screen13_UserProfile = lazy(() => import('../screens/Screen13_UserProfile'));
const Screen14_AlertsNotifications = lazy(() => import('../screens/Screen14_AlertsNotifications'));
const Screen15_MobileView = lazy(() => import('../screens/Screen15_MobileView'));

interface BlueprintViewProps {
  onSwitchToInteractive: (screenId?: number) => void;
  onOpenLiveSearch: () => void;
}

export const BlueprintView: React.FC<BlueprintViewProps> = ({
  onSwitchToInteractive,
  onOpenLiveSearch,
}) => {
  const [modalScreen, setModalScreen] = useState<{ id: number; title: string } | null>(null);

  const screenComponents: Record<number, React.LazyExoticComponent<React.ComponentType<any>>> = {
    1: Screen1_Login,
    2: Screen2_Dashboard,
    3: Screen3_NewSearch,
    4: Screen4_IdentityProfile,
    5: Screen5_DetailedReport,
    6: Screen6_Cases,
    7: Screen7_ReportsAnalytics,
    8: Screen8_Billing,
    9: Screen9_AdminConsole,
    10: Screen10_ProviderManagement,
    11: Screen11_PricingTiers,
    12: Screen12_ApiDocumentation,
    13: Screen13_UserProfile,
    14: Screen14_AlertsNotifications,
    15: Screen15_MobileView,
  };

  const ScreenWrapper: React.FC<{ id: number }> = ({ id }) => {
  const Comp = screenComponents[id];
  return (
    <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-cyan-400 text-xs">Loading…</div>}>
      <Comp />
    </Suspense>
  );
};

const screens = [
  { id: 1, title: '1. Login Page' },
  { id: 2, title: '2. Dashboard (Overview)' },
  { id: 3, title: '3. New Search / Investigation' },
  { id: 4, title: '4. Identity Profile (Results)' },
  { id: 5, title: '5. Detailed Report View' },
  { id: 6, title: '6. Cases / Investigations' },
  { id: 7, title: '7. Reports & Analytics' },
  { id: 8, title: '8. Billing & Subscriptions' },
  { id: 9, title: '9. Admin Console' },
  { id: 10, title: '10. Provider Management' },
  { id: 11, title: '11. Pricing & Tiers' },
  { id: 12, title: '12. API Documentation' },
  { id: 13, title: '13. User Profile & Settings' },
  { id: 14, title: '14. Alerts & Notifications' },
  { id: 15, title: '15. Mobile Responsive View' },
];

return (
    <div className="w-full bg-[#050b14] bg-tech-grid text-slate-100 p-2 sm:p-4 lg:p-6 space-y-6">
      {/* Floating Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#081527]/90 border border-sky-800/60 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white tracking-wide">
              IPRS National Platform Blueprint &bull; 15 System Modules
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/70 text-cyan-300 border border-cyan-500/30">
            Click any module to inspect or test
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenLiveSearch}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <span>Run Live Citizen ID Verification</span>
            <span className="text-[10px] font-mono bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-400/40">⚡ Demo</span>
          </button>
        </div>
      </div>

{/* 15 Screens Grid: 5 columns on wide monitors, responsive on tablet/mobile */}
        <Suspense fallback={<div className="w-full h-96 flex items-center justify-center text-cyan-400 text-sm">Loading modules…</div>}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
            {screens.map((screen) => (
              <div key={screen.id} className="flex flex-col space-y-1.5 group">
                {/* Screen Title Label */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] sm:text-xs font-bold text-slate-200 tracking-tight group-hover:text-cyan-300 transition-colors">
                    {screen.title}
                  </span>
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setModalScreen({ id: screen.id, title: screen.title })}
                      className="p-1 rounded bg-sky-950/70 hover:bg-sky-900 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
                      title="Expand preview"
                    >
                      <Maximize2 size={11} />
                    </button>
                    <button
                      onClick={() => onSwitchToInteractive(screen.id)}
                      className="p-1 rounded bg-sky-950/70 hover:bg-sky-900 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
                      title="Open live app mode"
                    >
                      <ExternalLink size={11} />
                    </button>
                  </div>
                </div>

                {/* Screen Card Container with interactive hover effect */}
                <div className="w-full h-[375px] sm:h-[390px] rounded-xl overflow-hidden border border-sky-950/90 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.18)] transition-all bg-[#071120] relative">
                  <ScreenWrapper id={screen.id} />
                </div>
              </div>
            ))}
          </div>
        </Suspense>

      {/* Bottom Technical Architecture & Platform Cards */}
      <div className="pt-2 space-y-4">
        {/* Row 1: System Architecture Flow */}
        <SystemArchitecture />

        {/* Row 2: Key Features, Security & Compliance, Deployment */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 flex">
            <KeyFeatures />
          </div>
          <div className="lg:col-span-5 flex">
            <SecurityCompliance />
          </div>
          <div className="lg:col-span-3 flex">
            <DeploymentCiCd />
          </div>
        </div>

        {/* Row 3: Brand Statement & Spin Mobile Tag */}
        <BrandFooter />
      </div>

      {/* Inspection Modal */}
      {modalScreen && (
        <ScreenModal
          isOpen={!!modalScreen}
          onClose={() => setModalScreen(null)}
          title={modalScreen.title}
          screenNumber={modalScreen.id}
          onSwitchToInteractiveMode={() => onSwitchToInteractive(modalScreen.id)}
        >
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-cyan-400 text-xs">Loading…</div>}>
            {(() => {
              const Comp = screenComponents[modalScreen.id];
              return <Comp />;
            })()}
          </Suspense>
        </ScreenModal>
      )}
    </div>
  );
};
