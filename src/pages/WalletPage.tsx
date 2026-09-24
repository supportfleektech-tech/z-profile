import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { WalletScreen } from '../components/screens/WalletScreen';

export const WalletPage: React.FC = () => (
  <PageLayout
    title="Wallet"
    badge="M-PESA · Card"
    relatedPages={[
      { label: 'Pricing Schedule', path: '/pricing' },
      { label: 'Billing & Invoices', path: '/billing' },
      { label: 'Payments Monitor', path: '/payments' },
    ]}
  >
    <WalletScreen />
  </PageLayout>
);

export default WalletPage;
