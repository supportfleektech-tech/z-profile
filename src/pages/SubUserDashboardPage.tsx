import React from 'react';
import { Screen16_SubUserDashboard } from '../components/screens/Screen16_SubUserDashboard';
import { useAppData } from '../context/AppDataContext';
import { useAppRouter } from '../context/RouterContext';

/**
 * Sub-user dashboard route wrapper.
 *
 * Redirects non-sub-users to the main dashboard.
 * Ensures the signed-in account is a sub-user with a host context.
 */
export const SubUserDashboardPage: React.FC = () => {
  const { currentUser } = useAppData();
  const { navigate } = useAppRouter();

  if (!currentUser || !currentUser.isSubUser) {
    navigate('/dashboard');
    return null;
  }

  return <Screen16_SubUserDashboard />;
};

export default SubUserDashboardPage;