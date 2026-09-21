import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen7_ReportsAnalytics } from '../components/screens/Screen7_ReportsAnalytics';

export const ReportsAnalyticsPage: React.FC = () => {
  return (
    <PageLayout
      title="7. Reports & Analytics"
      moduleNumber={7}
      badge="KES 482,600 MTD"
      relatedPages={[
        { label: 'View Billing & Invoices', path: '/billing' },
        { label: 'Check Provider Up-times', path: '/providers' },
        { label: 'API Usage Stats', path: '/api-docs' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen7_ReportsAnalytics />
      </div>
    </PageLayout>
  );
};
