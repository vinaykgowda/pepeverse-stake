// frontend/src/pages/DaoAdmin/Airdrops.jsx

import React from 'react';
import DaoAdminLayout from '../../components/Layout/DaoAdminLayout';
import DaoAirdropManager from '../../components/DaoAdmin/DaoAirdropManager';

const DaoAirdrops = () => {
  return (
    <DaoAdminLayout>
      <DaoAirdropManager />
    </DaoAdminLayout>
  );
};

export default DaoAirdrops;
