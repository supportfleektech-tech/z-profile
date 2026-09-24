import React from 'react';
import { useAppRouter } from '../../context/RouterContext';
import { useAppData } from '../../context/AppDataContext';
import { findRoute } from '../../types/routes';
import { AccessDenied } from './AccessDenied';

import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { NewSearchPage } from '../../pages/NewSearchPage';
import { IdentityProfilePage } from '../../pages/IdentityProfilePage';
import { DetailedReportPage } from '../../pages/DetailedReportPage';
import { CasesPage } from '../../pages/CasesPage';
import { WalletPage } from '../../pages/WalletPage';
import { ReportsAnalyticsPage } from '../../pages/ReportsAnalyticsPage';
import { BillingPage } from '../../pages/BillingPage';
import { PricingTiersPage } from '../../pages/PricingTiersPage';
import { PaymentsMonitorPage } from '../../pages/PaymentsMonitorPage';
import { AdminConsolePage } from '../../pages/AdminConsolePage';
import { ProviderManagementPage } from '../../pages/ProviderManagementPage';
import { SystemSettingsPage } from '../../pages/SystemSettingsPage';
import { AuditLogPage } from '../../pages/AuditLogPage';
import { ApiDocsPage } from '../../pages/ApiDocsPage';
import { UserProfilePage } from '../../pages/UserProfilePage';
import { NotificationsPage } from '../../pages/NotificationsPage';

/**
 * Route resolution with a role-based access guard.
 *
 * The guard runs on every navigation, including hash deep-links typed straight into the
 * address bar, so a `user`-tier account cannot reach `/admin`, `/settings` or `/payments`
 * even if it knows the path.
 */
export const PageRouter: React.FC = () => {
  const { currentPath } = useAppRouter();
  const { currentUser, can, isAuthenticated } = useAppData();

  const route = findRoute(currentPath);

  if (currentPath === '/login') return <LoginPage />;

  if (!isAuthenticated) return <LoginPage />;

  if (route) {
    const tierOk = !route.tiers || (currentUser ? route.tiers.includes(currentUser.tier) : false);
    const permOk = !route.permission || can(route.permission);
    if (!tierOk || !permOk) return <AccessDenied path={currentPath} />;
  }

  switch (currentPath) {
    case '/dashboard':
      return <DashboardPage />;
    case '/search':
      return <NewSearchPage />;
    case '/identity-profile':
      return <IdentityProfilePage />;
    case '/report':
      return <DetailedReportPage />;
    case '/cases':
      return <CasesPage />;
    case '/wallet':
      return <WalletPage />;
    case '/billing':
      return <BillingPage />;
    case '/pricing':
      return <PricingTiersPage />;
    case '/payments':
      return <PaymentsMonitorPage />;
    case '/analytics':
      return <ReportsAnalyticsPage />;
    case '/providers':
      return <ProviderManagementPage />;
    case '/api-docs':
      return <ApiDocsPage />;
    case '/admin':
      return <AdminConsolePage />;
    case '/settings':
      return <SystemSettingsPage />;
    case '/audit':
      return <AuditLogPage />;
    case '/notifications':
      return <NotificationsPage />;
    case '/profile':
      return <UserProfilePage />;
    default:
      return <DashboardPage />;
  }
};

export default PageRouter;
