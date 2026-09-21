import React from 'react';
import { useAppRouter } from '../context/RouterContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen2_Dashboard } from '../components/screens/Screen2_Dashboard';

export const DashboardPage: React.FC = () => {
  const { navigate } = useAppRouter();

  return (
    <PageLayout
      title="2. Dashboard (Overview)"
      moduleNumber={2}
      badge="Live Telemetry 99.98%"
      relatedPages={[
        { label: 'Start New Search', path: '/search' },
        { label: 'View Active Cases', path: '/cases' },
        { label: 'Revenue Analytics', path: '/analytics' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen2_Dashboard
          onNavigateToSearch={() => navigate('/search')}
          onNavigateToCases={() => navigate('/cases')}
          onNavigateToProfile={() => navigate('/identity-profile')}
        />
      </div>
    </PageLayout>
  );
};
