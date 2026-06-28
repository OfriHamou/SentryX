import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import AppLayout from '../layouts/AppLayout';
import Dashboard from '../pages/Dashboard';
import Live from '../pages/Live';
import Alerts from '../pages/Alerts';   
import Control from '../pages/Control';  
import History from '../pages/History';    
import Settings from '../pages/Settings';      
import AccessDenied from '../components/AccessDenied';
import { hasCustomerPermission, useCustomerAuth } from '../auth/CustomerAuthProvider';

type PermissionRequirement = {
  resource: string;
  action: 'read' | 'write';
};

function RequireCustomerPermission({
  anyOf,
  children,
}: {
  anyOf: PermissionRequirement[];
  children: ReactElement;
}) {
  const { user } = useCustomerAuth();
  const allowed = anyOf.some(({ resource, action }) =>
    hasCustomerPermission(user?.allowedPages, resource, action)
  );

  return allowed ? children : <AccessDenied />;
}

export default function CustomerRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<RequireCustomerPermission anyOf={[{ resource: 'dashboard', action: 'read' }]}><Dashboard /></RequireCustomerPermission>} />
        <Route path="/live" element={<RequireCustomerPermission anyOf={[{ resource: 'live', action: 'read' }]}><Live /></RequireCustomerPermission>} />
        <Route path="/alerts" element={<RequireCustomerPermission anyOf={[{ resource: 'alerts', action: 'read' }]}><Alerts /></RequireCustomerPermission>} />
        <Route path="/control" element={<RequireCustomerPermission anyOf={[{ resource: 'control', action: 'read' }]}><Control /></RequireCustomerPermission>} />
        <Route path="/history" element={<RequireCustomerPermission anyOf={[{ resource: 'history', action: 'read' }, { resource: 'events', action: 'read' }]}><History /></RequireCustomerPermission>} />
        <Route path="/settings" element={<RequireCustomerPermission anyOf={[{ resource: 'settings', action: 'read' }, { resource: 'robots', action: 'read' }, { resource: 'faces', action: 'read' }]}><Settings /></RequireCustomerPermission>} />
      </Route>
    </Routes>
  );
}
