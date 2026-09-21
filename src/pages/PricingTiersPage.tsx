import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen11_PricingTiers } from '../components/screens/Screen11_PricingTiers';

export const PricingTiersPage: React.FC = () => {
  return (
    <PageLayout
      title="11. Pricing & Tiers"
      moduleNumber={11}
      badge="Transparent Metering"
      relatedPages={[
        { label: 'Manage Current Subscription', path: '/billing' },
        { label: 'Developer API Documentation', path: '/api-docs' },
        { label: 'System Admin Console', path: '/admin' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen11_PricingTiers />
      </div>
    </PageLayout>
  );
};
