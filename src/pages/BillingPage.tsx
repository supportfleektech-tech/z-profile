import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen8_Billing } from '../components/screens/Screen8_Billing';

export const BillingPage: React.FC = () => {
  return (
    <PageLayout
      title="8. Billing & Subscriptions"
      moduleNumber={8}
      badge="Active Pro Plan"
      relatedPages={[
        { label: 'Compare Pricing Tiers', path: '/pricing' },
        { label: 'View Analytics Overview', path: '/analytics' },
        { label: 'Admin User Roles', path: '/admin' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen8_Billing />
      </div>
    </PageLayout>
  );
};
