import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import Dashboard from '../pages/Dashboard';
import Live from '../pages/Live';
import Alerts from '../pages/Alerts';   
import Control from '../pages/Control';      

export default function CustomerRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/live" element={<Live />} />
        <Route path="/alerts" element={<Alerts />} />  
        <Route path="/control" element={<Control />} />
      </Route>
    </Routes>
  );
}
