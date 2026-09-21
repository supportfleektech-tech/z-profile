import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen10_ProviderManagement } from '../components/screens/Screen10_ProviderManagement';

export const ProviderManagementPage: React.FC = () => {
  return (
    <PageLayout
      title="10. Provider Management"
      moduleNumber={10}
      badge="5 / 5 Gateways Synced"
      relatedPages={[
        { label: 'Admin Security Team', path: '/admin' },
        { label: 'API Developer Portal', path: '/api-docs' },
        { label: 'View System Analytics', path: '/analytics' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen10_ProviderManagement />
      </div>
    </PageLayout>
  );
};
