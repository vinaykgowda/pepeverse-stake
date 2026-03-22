// frontend/src/pages/Admin/Collections.jsx

import React from 'react';
import AdminLayout from '../../components/Layout/AdminLayout';
import CollectionManager from '../../components/Admin/CollectionManager';

const Collections = () => {
  return (
    <AdminLayout>
      <CollectionManager />
    </AdminLayout>
  );
};

export default Collections;