import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen13_UserProfile } from '../components/screens/Screen13_UserProfile';

export const UserProfilePage: React.FC = () => {
  return (
    <PageLayout
      title="13. User Profile & Settings"
      moduleNumber={13}
      badge="FIPS 140-2 Compliant"
      relatedPages={[
        { label: 'Security & Alert Center', path: '/notifications' },
        { label: 'Admin Security Team', path: '/admin' },
        { label: 'API Developer Tokens', path: '/api-docs' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen13_UserProfile />
      </div>
    </PageLayout>
  );
};
