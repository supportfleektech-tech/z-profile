import React from 'react';
import { Screen1_Login } from '../components/screens/Screen1_Login';

/**
 * Login is deliberately rendered OUTSIDE the AppShell/PageLayout chrome — it is a
 * full-viewport, unauthenticated surface. On success Screen1_Login navigates to
 * /dashboard, where the tier-specific dashboard takes over.
 */
export const LoginPage: React.FC = () => <Screen1_Login onLoginSuccess={() => undefined} />;

export default LoginPage;
