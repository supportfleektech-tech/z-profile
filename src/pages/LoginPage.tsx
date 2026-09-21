import React from 'react';
import { useAppRouter } from '../context/RouterContext';
import { PageLayout } from '../components/layout/PageLayout';
import { Screen1_Login } from '../components/screens/Screen1_Login';

export const LoginPage: React.FC = () => {
  const { navigate } = useAppRouter();

  return (
    <PageLayout
      title="1. Login Page"
      moduleNumber={1}
      badge="OAuth 2.0 / SAML"
      relatedPages={[
        { label: 'Go to Dashboard', path: '/dashboard' },
        { label: 'API Credentials', path: '/api-docs' },
        { label: 'Security Settings', path: '/profile' },
      ]}
    >
      <div className="p-2 sm:p-4">
        <Screen1_Login onLoginSuccess={() => navigate('/dashboard')} />
      </div>
    </PageLayout>
  );
};
