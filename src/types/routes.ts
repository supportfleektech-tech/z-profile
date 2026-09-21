export interface PageRoute {
  id: string;
  path: string;
  title: string;
  shortTitle: string;
  moduleNumber?: number;
  category: 'core' | 'operations' | 'system' | 'business';
  icon: string;
  description: string;
}

export const platformRoutes: PageRoute[] = [
  {
    id: 'login',
    path: '/login',
    title: '1. Login Page',
    shortTitle: 'Login',
    moduleNumber: 1,
    category: 'core',
    icon: 'LogIn',
    description: 'Secure authentication gateway & credential verification'
  },
  {
    id: 'dashboard',
    path: '/dashboard',
    title: '2. Dashboard (Overview)',
    shortTitle: 'Dashboard',
    moduleNumber: 2,
    category: 'core',
    icon: 'LayoutDashboard',
    description: 'Real-time telemetry, transaction volumes, searches and revenue metrics'
  },
  {
    id: 'new-search',
    path: '/search',
    title: '3. New Search / Investigation',
    shortTitle: 'New Search',
    moduleNumber: 3,
    category: 'operations',
    icon: 'Search',
    description: 'Instant querying across national registry, M-PESA, CRB, and utilities'
  },
  {
    id: 'identity-profile',
    path: '/identity-profile',
    title: '4. Identity Profile (Results)',
    shortTitle: 'Identity Profile',
    moduleNumber: 4,
    category: 'operations',
    icon: 'UserCheck',
    description: 'Citizen dossier with cross-registry verified status badges'
  },
  {
    id: 'detailed-report',
    path: '/report',
    title: '5. Detailed Report View',
    shortTitle: 'Detailed Report',
    moduleNumber: 5,
    category: 'operations',
    icon: 'FileBarChart2',
    description: 'Comprehensive risk score gauge (92% Low Risk) and audit report'
  },
  {
    id: 'cases',
    path: '/cases',
    title: '6. Cases / Investigations',
    shortTitle: 'Cases',
    moduleNumber: 6,
    category: 'operations',
    icon: 'Briefcase',
    description: 'Case tracking pipeline with filtering and priority assignment'
  },
  {
    id: 'reports-analytics',
    path: '/analytics',
    title: '7. Reports & Analytics',
    shortTitle: 'Analytics',
    moduleNumber: 7,
    category: 'business',
    icon: 'BarChart3',
    description: 'Registry breakdown donut chart, revenue bar chart, and service metrics'
  },
  {
    id: 'billing',
    path: '/billing',
    title: '8. Billing & Subscriptions',
    shortTitle: 'Billing',
    moduleNumber: 8,
    category: 'business',
    icon: 'CreditCard',
    description: 'Tiered quota meter, invoice records, and M-PESA billing integrations'
  },
  {
    id: 'admin-console',
    path: '/admin',
    title: '9. Admin Console',
    shortTitle: 'Admin Console',
    moduleNumber: 9,
    category: 'system',
    icon: 'Shield',
    description: 'Role-based access management, security team permissions, and audit controls'
  },
  {
    id: 'provider-management',
    path: '/providers',
    title: '10. Provider Management',
    shortTitle: 'Providers',
    moduleNumber: 10,
    category: 'system',
    icon: 'Server',
    description: 'Gateway health, latency telemetry, and sync ping controls'
  },
  {
    id: 'pricing',
    path: '/pricing',
    title: '11. Pricing & Tiers',
    shortTitle: 'Pricing & Tiers',
    moduleNumber: 11,
    category: 'business',
    icon: 'Layers',
    description: 'Subscription tiers (Starter, Professional, Business, Enterprise)'
  },
  {
    id: 'api-docs',
    path: '/api-docs',
    title: '12. API Documentation',
    shortTitle: 'API Docs',
    moduleNumber: 12,
    category: 'system',
    icon: 'Code2',
    description: 'REST v1.4.2 endpoints, bearer token generator, and cURL references'
  },
  {
    id: 'user-profile',
    path: '/profile',
    title: '13. User Profile & Settings',
    shortTitle: 'Profile & Settings',
    moduleNumber: 13,
    category: 'core',
    icon: 'UserCog',
    description: 'Account security, 2FA credentials, and notification preferences'
  },
  {
    id: 'notifications',
    path: '/notifications',
    title: '14. Alerts & Notifications',
    shortTitle: 'Notifications',
    moduleNumber: 14,
    category: 'operations',
    icon: 'Bell',
    description: 'Real-time security alerts, case dispatch, and payment logs'
  },
  {
    id: 'mobile-view',
    path: '/mobile-view',
    title: '15. Mobile Responsive View',
    shortTitle: 'Mobile PWA',
    moduleNumber: 15,
    category: 'system',
    icon: 'Smartphone',
    description: 'Native mobile device viewports and responsive touch flow'
  },
  {
    id: 'blueprint',
    path: '/blueprint',
    title: 'Full Blueprint Poster Grid',
    shortTitle: 'Poster Blueprint',
    category: 'system',
    icon: 'LayoutGrid',
    description: 'Panoramic 15-screen master architecture poster view'
  }
];
