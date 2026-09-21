import React from 'react';
import { useAppRouter } from '../context/RouterContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen3_NewSearch } from '../components/screens/Screen3_NewSearch';

export const NewSearchPage: React.FC = () => {
  const { navigate } = useAppRouter();

  return (
    <PageLayout
      title="3. New Search / Investigation"
      moduleNumber={3}
      badge="National Registries Online"
      relatedPages={[
        { label: 'View Profile Results', path: '/identity-profile' },
        { label: 'Detailed Audit Report', path: '/report' },
        { label: 'Cases Pipeline', path: '/cases' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen3_NewSearch
          onExecuteSearch={() => navigate('/identity-profile')}
        />
      </div>
    </PageLayout>
  );
};
