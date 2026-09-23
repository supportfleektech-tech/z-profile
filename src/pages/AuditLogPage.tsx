import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { AuditLogScreen } from '../components/screens/AuditLogScreen';

export const AuditLogPage: React.FC = () => (
  <PageLayout
    title="Audit Log & Sessions"
    badge="Append-only"
    relatedPages={[
      { label: 'Admin Console', path: '/admin' },
      { label: 'System Settings', path: '/settings' },
      { label: 'Payments Monitor', path: '/payments' },
      { label: 'User Profile', path: '/profile' },
    ]}
  >
    <AuditLogScreen />
  </PageLayout>
);

export default AuditLogPage;
