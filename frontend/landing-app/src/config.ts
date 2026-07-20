export const APP_URLS = {
  customer: import.meta.env.VITE_CUSTOMER_URL,
  organization: import.meta.env.VITE_ORGANIZATION_URL,
  admin: import.meta.env.VITE_ADMIN_URL,
} as const;

export const gradientText = {
  background: 'linear-gradient(120deg, #863BFF 0%, #47BFFF 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
} as const;
