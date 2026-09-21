import React from 'react';
import { useAppRouter } from '../context/RouterContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen4_IdentityProfile } from '../components/screens/Screen4_IdentityProfile';

export const IdentityProfilePage: React.FC = () => {
  const { navigate } = useAppRouter();

  return (
    <PageLayout
      title="4. Identity Profile (Results)"
      moduleNumber={4}
      badge="Citizen Dossier Verified"
      relatedPages={[
        { label: 'Download Detailed Report', path: '/report' },
        { label: 'Create Investigation Case', path: '/cases' },
        { label: 'Search Another Subject', path: '/search' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen4_IdentityProfile
          onViewDetailedReport={() => navigate('/report')}
        />
      </div>
    </PageLayout>
  );
};
