import React from 'react';
import { Screen2_Register } from '../components/screens/Screen2_Register';

/**
 * Public organisation registration — rendered OUTSIDE the AppShell chrome,
 * like Login. No authentication required.
 */
export const RegisterPage: React.FC = () => <Screen2_Register />;

export default RegisterPage;
