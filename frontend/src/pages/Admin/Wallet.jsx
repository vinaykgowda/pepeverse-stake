// frontend/src/pages/Admin/Wallet.jsx

import React from 'react';
import AdminLayout from '../../components/Layout/AdminLayout';
import WalletManager from '../../components/Admin/WalletManager';

const Wallet = () => {
  return (
    <AdminLayout>
      <WalletManager />
    </AdminLayout>
  );
};

export default Wallet;