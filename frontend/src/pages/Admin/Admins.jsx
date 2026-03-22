// frontend/src/pages/Admin/Admins.jsx

import React from 'react';
import AdminLayout from '../../components/Layout/AdminLayout';
import AdminManager from '../../components/Admin/AdminManager';

const Admins = () => {
  return (
    <AdminLayout>
      <AdminManager />
    </AdminLayout>
  );
};

export default Admins;