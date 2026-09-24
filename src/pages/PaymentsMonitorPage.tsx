import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { PaymentsMonitorScreen } from '../components/screens/PaymentsMonitorScreen';

export const PaymentsMonitorPage: React.FC = () => (
  <PageLayout
    title="Payments Monitor"
    badge="Admin / Super Admin"
    relatedPages={[
      { label: 'Wallet', path: '/wallet' },
      { label: 'Billing & Invoices', path: '/billing' },
      { label: 'Provider Management', path: '/providers' },
      { label: 'Audit Log', path: '/audit' },
    ]}
  >
    <PaymentsMonitorScreen />
  </PageLayout>
);

export default PaymentsMonitorPage;
