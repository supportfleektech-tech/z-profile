import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen12_ApiDocumentation } from '../components/screens/Screen12_ApiDocumentation';

export const ApiDocsPage: React.FC = () => {
  return (
    <PageLayout
      title="12. API Documentation"
      moduleNumber={12}
      badge="REST v1.4.2 mTLS"
      relatedPages={[
        { label: 'Check Provider Gateways', path: '/providers' },
        { label: 'View Pricing & Quotas', path: '/pricing' },
        { label: 'Account API Keys', path: '/profile' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen12_ApiDocumentation />
      </div>
    </PageLayout>
  );
};
