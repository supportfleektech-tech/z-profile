import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen5_DetailedReport } from '../components/screens/Screen5_DetailedReport';

export const DetailedReportPage: React.FC = () => {
  return (
    <PageLayout
      title="5. Detailed Report View"
      moduleNumber={5}
      badge="Risk Score: 92% (Low Risk)"
      relatedPages={[
        { label: 'Back to Profile Dossier', path: '/identity-profile' },
        { label: 'File Official Case', path: '/cases' },
        { label: 'Platform Analytics', path: '/analytics' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen5_DetailedReport />
      </div>
    </PageLayout>
  );
};
