import React from 'react';
import { useAppRouter } from '../context/RouterContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen6_Cases } from '../components/screens/Screen6_Cases';

export const CasesPage: React.FC = () => {
  const { navigate } = useAppRouter();

  return (
    <PageLayout
      title="6. Cases / Investigations"
      moduleNumber={6}
      badge="5 Active Workflows"
      relatedPages={[
        { label: 'Perform New Registry Search', path: '/search' },
        { label: 'View Subject Profile', path: '/identity-profile' },
        { label: 'Platform Analytics', path: '/analytics' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen6_Cases
          onSelectCase={() => navigate('/identity-profile')}
        />
      </div>
    </PageLayout>
  );
};
