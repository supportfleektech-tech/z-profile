import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen9_AdminConsole } from '../components/screens/Screen9_AdminConsole';

export const AdminConsolePage: React.FC = () => {
  return (
    <PageLayout
      title="9. Admin Console"
      moduleNumber={9}
      badge="Role-Based Security (ABAC)"
      relatedPages={[
        { label: 'Provider Gateways', path: '/providers' },
        { label: 'API Keys & Secrets', path: '/api-docs' },
        { label: 'Security Notifications', path: '/notifications' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen9_AdminConsole />
      </div>
    </PageLayout>
  );
};
