import React, { useState } from 'react';
import {
  LogIn,
  LayoutDashboard,
  Search,
  UserCheck,
  FileCheck2,
  Briefcase,
  BarChart3,
  CreditCard,
  Shield,
  Server,
  Layers,
  Code2,
  UserCog,
  Bell,
  Smartphone,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
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

interface LiveAppModeProps {
  onBackToBlueprint: () => void;
  initialScreenId?: number;
}

export const LiveAppMode: React.FC<LiveAppModeProps> = ({
  onBackToBlueprint,
  initialScreenId = 2,
}) => {
  const [activeScreen, setActiveScreen] = useState<number>(initialScreenId);

  const menuItems = [
    { id: 1, label: '1. Login Page', icon: <LogIn size={15} /> },
    { id: 2, label: '2. Dashboard (Overview)', icon: <LayoutDashboard size={15} /> },
    { id: 3, label: '3. New Search / Investigation', icon: <Search size={15} /> },
    { id: 4, label: '4. Identity Profile (Results)', icon: <UserCheck size={15} /> },
    { id: 5, label: '5. Detailed Report View', icon: <FileCheck2 size={15} /> },
    { id: 6, label: '6. Cases / Investigations', icon: <Briefcase size={15} /> },
    { id: 7, label: '7. Reports & Analytics', icon: <BarChart3 size={15} /> },
    { id: 8, label: '8. Billing & Subscriptions', icon: <CreditCard size={15} /> },
    { id: 9, label: '9. Admin Console', icon: <Shield size={15} /> },
    { id: 10, label: '10. Provider Management', icon: <Server size={15} /> },
    { id: 11, label: '11. Pricing & Tiers', icon: <Layers size={15} /> },
    { id: 12, label: '12. API Documentation', icon: <Code2 size={15} /> },
    { id: 13, label: '13. User Profile & Settings', icon: <UserCog size={15} /> },
    { id: 14, label: '14. Alerts & Notifications', icon: <Bell size={15} /> },
    { id: 15, label: '15. Mobile Responsive View', icon: <Smartphone size={15} /> },
  ];

  const currentItem = menuItems.find((m) => m.id === activeScreen) || menuItems[1];

  return (
    <div className="w-full flex-1 flex flex-col md:flex-row min-h-[calc(100vh-70px)] bg-[#040812]">
      {/* Sidebar for Navigation */}
      <aside className="w-full md:w-64 bg-[#060e1c] border-b md:border-b-0 md:border-r border-sky-950/80 p-3 flex flex-col justify-between shrink-0">
        <div>
          {/* Back button */}
          <button
            onClick={onBackToBlueprint}
            className="w-full mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/60 text-cyan-300 text-xs font-semibold transition-all group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            <span>Back to Blueprint Poster</span>
          </button>

          <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            All 15 Platform Modules
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1 max-h-[60vh] md:max-h-[calc(100vh-210px)] overflow-y-auto pr-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveScreen(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                  activeScreen === item.id
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)] font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-sky-950/50'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className={activeScreen === item.id ? 'text-white' : 'text-cyan-400'}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                <ChevronRight
                  size={12}
                  className={activeScreen === item.id ? 'text-white' : 'text-slate-600'}
                />
              </button>
            ))}
          </nav>
        </div>

        {/* Status in Sidebar bottom */}
        <div className="pt-3 border-t border-sky-950/80 mt-3 text-[10px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Production Sandbox
          </div>
          <div>Spin Mobile Gateway: v2.4.1</div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col p-3 sm:p-5 md:p-6 overflow-y-auto bg-gradient-to-br from-[#060e1c] to-[#040812]">
        {/* Breadcrumb Header */}
        <div className="mb-4 pb-3 border-b border-sky-950/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>IPRS Platform</span>
            <span>/</span>
            <span className="text-cyan-300 font-semibold">{currentItem.label}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">Module #{activeScreen} of 15</span>
          </div>
        </div>

        {/* Active Screen Component Container */}
        <div className="flex-1 w-full max-w-6xl mx-auto rounded-xl shadow-2xl">
          {activeScreen === 1 && <Screen1_Login onLoginSuccess={() => setActiveScreen(2)} />}
          {activeScreen === 2 && (
            <Screen2_Dashboard
              onNavigateToSearch={() => setActiveScreen(3)}
              onNavigateToCases={() => setActiveScreen(6)}
              onNavigateToProfile={() => setActiveScreen(4)}
            />
          )}
          {activeScreen === 3 && (
            <Screen3_NewSearch
              onExecuteSearch={() => setActiveScreen(4)}
            />
          )}
          {activeScreen === 4 && (
            <Screen4_IdentityProfile
              onViewDetailedReport={() => setActiveScreen(5)}
            />
          )}
          {activeScreen === 5 && <Screen5_DetailedReport />}
          {activeScreen === 6 && (
            <Screen6_Cases
              onSelectCase={() => setActiveScreen(4)}
            />
          )}
          {activeScreen === 7 && <Screen7_ReportsAnalytics />}
          {activeScreen === 8 && <Screen8_Billing />}
          {activeScreen === 9 && <Screen9_AdminConsole />}
          {activeScreen === 10 && <Screen10_ProviderManagement />}
          {activeScreen === 11 && <Screen11_PricingTiers />}
          {activeScreen === 12 && <Screen12_ApiDocumentation />}
          {activeScreen === 13 && <Screen13_UserProfile />}
          {activeScreen === 14 && <Screen14_AlertsNotifications />}
          {activeScreen === 15 && <Screen15_MobileView />}
        </div>
      </main>
    </div>
  );
};
