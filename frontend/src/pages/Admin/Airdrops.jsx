// frontend/src/pages/Admin/Airdrops.jsx

import React from 'react';
import AdminLayout from '../../components/Layout/AdminLayout';
import AirdropManager from '../../components/Admin/AirdropManager';

const Airdrops = () => {
  return (
    <AdminLayout>
      <AirdropManager />
    </AdminLayout>
  );
};

export default Airdrops;
