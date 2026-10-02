import React from 'react';
import { Screen15_PendingApprovals } from '../components/screens/Screen15_PendingApprovals';
import { PageLayout } from '../components/layout/PageLayout';

/**
 * Super Admin review queue — `registrations.review`-gated by the router.
 */
export const PendingApprovalsPage: React.FC = () => (
  <PageLayout
    title="19. Pending Approvals"
    badge="Super Admin Review"
    relatedPages={[
      { label: 'Team & Access Control', path: '/admin' },
      { label: 'Audit Log', path: '/audit' },
    ]}
  >
    <div className="p-2 sm:p-4">
      <Screen15_PendingApprovals />
    </div>
  </PageLayout>
);

export default PendingApprovalsPage;
