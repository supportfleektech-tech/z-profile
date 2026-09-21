import React, { useState } from 'react';
import { Maximize2, ExternalLink } from 'lucide-react';
import { Screen1_Login } from '../screens/Screen1_Login';
import { Screen2_Dashboard } from '../screens/Screen2_Dashboard';
import { Screen3_NewSearch } from '../screens/Screen3_NewSearch';
import { Screen4_IdentityProfile } from '../screens/Screen4_IdentityProfile';
import { Screen5_DetailedReport } from '../screens/Screen5_DetailedReport';
import { Screen6_Cases } from '../screens/Screen6_Cases';
import { Screen7_ReportsAnalytics } from '../screens/Screen7_ReportsAnalytics';
import { Screen8_Billing } from '../screens/Screen8_Billing';
import { Screen9_AdminConsole } from '../screens/Screen9_AdminConsole';
import { Screen10_ProviderManagement } from '../screens/Screen10_ProviderManagement';
import { Screen11_PricingTiers } from '../screens/Screen11_PricingTiers';
import { Screen12_ApiDocumentation } from '../screens/Screen12_ApiDocumentation';
import { Screen13_UserProfile } from '../screens/Screen13_UserProfile';
import { Screen14_AlertsNotifications } from '../screens/Screen14_AlertsNotifications';
import { Screen15_MobileView } from '../screens/Screen15_MobileView';

import { SystemArchitecture } from '../footer/SystemArchitecture';
import { KeyFeatures } from '../footer/KeyFeatures';
import { SecurityCompliance } from '../footer/SecurityCompliance';
import { DeploymentCiCd } from '../footer/DeploymentCiCd';
import { BrandFooter } from '../footer/BrandFooter';
import { ScreenModal } from '../interactive/ScreenModal';

interface BlueprintViewProps {
  onSwitchToInteractive: (screenId?: number) => void;
  onOpenLiveSearch: () => void;
}

export const BlueprintView: React.FC<BlueprintViewProps> = ({
  onSwitchToInteractive,
  onOpenLiveSearch,
}) => {
  const [modalScreen, setModalScreen] = useState<{ id: number; title: string; component: React.ReactNode } | null>(null);

  const screens = [
    {
      id: 1,
      title: '1. Login Page',
      component: <Screen1_Login onLoginSuccess={() => onSwitchToInteractive(2)} />,
    },
    {
      id: 2,
      title: '2. Dashboard (Overview)',
      component: (
        <Screen2_Dashboard
          onNavigateToSearch={() => onSwitchToInteractive(3)}
          onNavigateToCases={() => onSwitchToInteractive(6)}
          onNavigateToProfile={() => onSwitchToInteractive(4)}
        />
      ),
    },
    {
      id: 3,
      title: '3. New Search / Investigation',
      component: (
        <Screen3_NewSearch
          onExecuteSearch={() => onSwitchToInteractive(4)}
        />
      ),
    },
    {
      id: 4,
      title: '4. Identity Profile (Results)',
      component: (
        <Screen4_IdentityProfile
          onViewDetailedReport={() => onSwitchToInteractive(5)}
        />
      ),
    },
    {
      id: 5,
      title: '5. Detailed Report View',
      component: <Screen5_DetailedReport />,
    },
    {
      id: 6,
      title: '6. Cases / Investigations',
      component: (
        <Screen6_Cases
          onSelectCase={() => onSwitchToInteractive(4)}
        />
      ),
    },
    {
      id: 7,
      title: '7. Reports & Analytics',
      component: <Screen7_ReportsAnalytics />,
    },
    {
      id: 8,
      title: '8. Billing & Subscriptions',
      component: <Screen8_Billing />,
    },
    {
      id: 9,
      title: '9. Admin Console',
      component: <Screen9_AdminConsole />,
    },
    {
      id: 10,
      title: '10. Provider Management',
      component: <Screen10_ProviderManagement />,
    },
    {
      id: 11,
      title: '11. Pricing & Tiers',
      component: <Screen11_PricingTiers />,
    },
    {
      id: 12,
      title: '12. API Documentation',
      component: <Screen12_ApiDocumentation />,
    },
    {
      id: 13,
      title: '13. User Profile & Settings',
      component: <Screen13_UserProfile />,
    },
    {
      id: 14,
      title: '14. Alerts & Notifications',
      component: <Screen14_AlertsNotifications />,
    },
    {
      id: 15,
      title: '15. Mobile Responsive View',
      component: <Screen15_MobileView />,
    },
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
                  onClick={() => setModalScreen(screen)}
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
              {screen.component}
            </div>
          </div>
        ))}
      </div>

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
          {modalScreen.component}
        </ScreenModal>
      )}
    </div>
  );
};
