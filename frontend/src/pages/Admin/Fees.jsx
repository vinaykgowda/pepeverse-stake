// frontend/src/pages/Admin/Fees.jsx

import React from 'react';
import AdminLayout from '../../components/Layout/AdminLayout';
import FeeManager from '../../components/Admin/FeeManager';

const Fees = () => {
  return (
    <AdminLayout>
      <FeeManager />
    </AdminLayout>
  );
};

export default Fees;