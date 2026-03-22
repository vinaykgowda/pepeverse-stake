// frontend/src/pages/Admin/Dashboard.jsx

import React from 'react';
import AdminLayout from '../../components/Layout/AdminLayout';
import DashboardComponent from '../../components/Admin/Dashboard';

const Dashboard = () => {
  return (
    <AdminLayout>
      <DashboardComponent />
    </AdminLayout>
  );
};

export default Dashboard;