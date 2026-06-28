import React from 'react';

interface PermissionGateProps {
  allowed: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PermissionGate: React.FC<PermissionGateProps> = ({ allowed, children, fallback = null }) => {
  return allowed ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGate;
