import React from 'react';
import { useAppRouter } from '../context/RouterContext';
import { BlueprintView } from '../components/blueprint/BlueprintView';
import { PageLayout } from '../components/layout/PageLayout';

export const MasterBlueprintPage: React.FC = () => {
  const { navigate } = useAppRouter();

  return (
    <PageLayout
      title="All-in-One Architecture Poster"
      badge="15 Modules &amp; Full System Diagram"
      relatedPages={[
        { label: 'Login Gateway', path: '/login' },
        { label: 'Executive Dashboard', path: '/dashboard' },
        { label: 'Verification Search', path: '/search' },
      ]}
    >
      <div className="p-1 sm:p-2">
        <BlueprintView
          onSwitchToInteractive={(screenId?: number) => {
            const routesByNumber: { [key: number]: string } = {
              1: '/login',
              2: '/dashboard',
              3: '/search',
              4: '/identity-profile',
              5: '/report',
              6: '/cases',
              7: '/analytics',
              8: '/billing',
              9: '/admin',
              10: '/providers',
              11: '/pricing',
              12: '/api-docs',
              13: '/profile',
              14: '/notifications',
              15: '/mobile-view',
            };
            const targetPath = screenId ? routesByNumber[screenId] || '/dashboard' : '/dashboard';
            navigate(targetPath);
          }}
          onOpenLiveSearch={() => navigate('/search')}
        />
      </div>
    </PageLayout>
  );
};
