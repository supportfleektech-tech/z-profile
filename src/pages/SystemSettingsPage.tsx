import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { SystemSettingsScreen } from '../components/screens/SystemSettingsScreen';

export const SystemSettingsPage: React.FC = () => (
  <PageLayout
    title="System Settings"
    badge="Policy · Platform · Compliance"
    relatedPages={[
      { label: 'Admin Console', path: '/admin' },
      { label: 'Provider Management', path: '/providers' },
      { label: 'Audit Log', path: '/audit' },
      { label: 'Payments Monitor', path: '/payments' },
    ]}
  >
    <SystemSettingsScreen />
  </PageLayout>
);

export default SystemSettingsPage;
