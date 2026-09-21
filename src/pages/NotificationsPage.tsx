import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen14_AlertsNotifications } from '../components/screens/Screen14_AlertsNotifications';

export const NotificationsPage: React.FC = () => {
  return (
    <PageLayout
      title="14. Alerts & Notifications"
      moduleNumber={14}
      badge="Real-time Dispatch"
      relatedPages={[
        { label: 'Check Active Cases', path: '/cases' },
        { label: 'Provider Health Checks', path: '/providers' },
        { label: 'Security Profile', path: '/profile' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen14_AlertsNotifications />
      </div>
    </PageLayout>
  );
};
