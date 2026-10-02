import React from 'react';
import { Screen0_GetStarted } from '../components/screens/Screen0_GetStarted';

/**
 * Public onboarding explainer — rendered OUTSIDE the AppShell chrome, like
 * Login. No authentication required.
 */
export const GetStartedPage: React.FC = () => <Screen0_GetStarted />;

export default GetStartedPage;
