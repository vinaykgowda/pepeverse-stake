// src/components/Auth/DaoAdminRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useDaoAuth } from '../../context/DaoAuthContext';

const DaoAdminRoute = ({ children }) => {
  const { isDaoAdmin, loading } = useDaoAuth();

  if (loading) {
    return null;
  }

  if (!isDaoAdmin) {
    return <Navigate to="/dao-admin/login" />;
  }

  return children;
};

export default DaoAdminRoute;
