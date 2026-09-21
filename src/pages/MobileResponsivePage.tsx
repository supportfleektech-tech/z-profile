import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen15_MobileView } from '../components/screens/Screen15_MobileView';

export const MobileResponsivePage: React.FC = () => {
  return (
    <PageLayout
      title="15. Mobile Responsive View"
      moduleNumber={15}
      badge="PWA / iOS / Android"
      relatedPages={[
        { label: 'Back to Desktop Dashboard', path: '/dashboard' },
        { label: 'Perform New Search', path: '/search' },
        { label: 'API Developer Gateway', path: '/api-docs' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen15_MobileView />
      </div>
    </PageLayout>
  );
};
