import React from 'react';
import { useAppData } from '../context/AppDataContext';
import { PageLayout } from '../components/layout/PageLayout';
import { DashboardUser } from '../components/dashboards/DashboardUser';
import { DashboardAdmin } from '../components/dashboards/DashboardAdmin';
import { DashboardSuperAdmin } from '../components/dashboards/DashboardSuperAdmin';
import { TIER_META } from '../auth/permissions';
import type { RoleTier } from '../types';

const TITLES: Record<RoleTier, { title: string; badge: string }> = {
  user: { title: 'Workspace', badge: 'User Dashboard' },
  admin: { title: 'Operations', badge: 'Admin Dashboard' },
  super_admin: { title: 'Platform Control', badge: 'Super Admin Dashboard' },
};

/**
 * The dashboard is tier-resolved: the same `/dashboard` path renders a completely
 * different workspace depending on who signed in. A User never sees Admin controls, and
 * only Super Admin gets governance, margin and platform-policy surfaces.
 */
export const DashboardPage: React.FC = () => {
  const { currentUser } = useAppData();
  const tier: RoleTier = currentUser?.tier ?? 'user';
  const meta = TITLES[tier];

  const related =
    tier === 'super_admin'
      ? [
          { label: 'Admin Console', path: '/admin' },
          { label: 'System Settings', path: '/settings' },
          { label: 'Audit Log', path: '/audit' },
          { label: 'Payments Monitor', path: '/payments' },
        ]
      : tier === 'admin'
        ? [
            { label: 'Provider Management', path: '/providers' },
            { label: 'Payments Monitor', path: '/payments' },
            { label: 'Admin Console', path: '/admin' },
            { label: 'Reports & Analytics', path: '/analytics' },
          ]
        : [
            { label: 'New Verification', path: '/search' },
            { label: 'My Cases', path: '/cases' },
            { label: 'Wallet', path: '/wallet' },
            { label: 'Pricing Schedule', path: '/pricing' },
          ];

  return (
    <PageLayout
      title={meta.title}
      badge={meta.badge}
      subtitle={TIER_META[tier].label}
      relatedPages={related}
    >
      <div className="p-2 sm:p-4">
        {tier === 'super_admin' ? (
          <DashboardSuperAdmin />
        ) : tier === 'admin' ? (
          <DashboardAdmin />
        ) : (
          <DashboardUser />
        )}
      </div>
    </PageLayout>
  );
};

export default DashboardPage;
