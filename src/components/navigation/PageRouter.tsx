import React from 'react';
import { useAppRouter } from '../../context/RouterContext';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { NewSearchPage } from '../../pages/NewSearchPage';
import { IdentityProfilePage } from '../../pages/IdentityProfilePage';
import { DetailedReportPage } from '../../pages/DetailedReportPage';
import { CasesPage } from '../../pages/CasesPage';
import { ReportsAnalyticsPage } from '../../pages/ReportsAnalyticsPage';
import { BillingPage } from '../../pages/BillingPage';
import { AdminConsolePage } from '../../pages/AdminConsolePage';
import { ProviderManagementPage } from '../../pages/ProviderManagementPage';
import { PricingTiersPage } from '../../pages/PricingTiersPage';
import { ApiDocsPage } from '../../pages/ApiDocsPage';
import { UserProfilePage } from '../../pages/UserProfilePage';
import { NotificationsPage } from '../../pages/NotificationsPage';
import { MobileResponsivePage } from '../../pages/MobileResponsivePage';
import { MasterBlueprintPage } from '../../pages/MasterBlueprintPage';

export const PageRouter: React.FC = () => {
  const { currentPath } = useAppRouter();

  switch (currentPath) {
    case '/login':
      return <LoginPage />;
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
    case '/analytics':
      return <ReportsAnalyticsPage />;
    case '/billing':
      return <BillingPage />;
    case '/admin':
      return <AdminConsolePage />;
    case '/providers':
      return <ProviderManagementPage />;
    case '/pricing':
      return <PricingTiersPage />;
    case '/api-docs':
      return <ApiDocsPage />;
    case '/profile':
      return <UserProfilePage />;
    case '/notifications':
      return <NotificationsPage />;
    case '/mobile-view':
      return <MobileResponsivePage />;
    case '/blueprint':
      return <MasterBlueprintPage />;
    default:
      return <DashboardPage />;
  }
};
