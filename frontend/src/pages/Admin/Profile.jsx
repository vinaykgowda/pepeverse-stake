// frontend/src/pages/Admin/Profile.jsx

import React from 'react';
import AdminLayout from '../../components/Layout/AdminLayout';
import ProfileSettings from '../../components/Admin/ProfileSettings';

const Profile = () => {
  return (
    <AdminLayout>
      <ProfileSettings />
    </AdminLayout>
  );
};

export default Profile;