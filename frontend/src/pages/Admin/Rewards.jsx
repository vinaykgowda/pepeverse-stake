// frontend/src/pages/Admin/Rewards.jsx

import React from 'react';
import AdminLayout from '../../components/Layout/AdminLayout';
import RewardsManager from '../../components/Admin/RewardsManager';

const Rewards = () => {
  return (
    <AdminLayout>
      <RewardsManager />
    </AdminLayout>
  );
};

export default Rewards;