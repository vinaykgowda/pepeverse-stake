// frontend/src/components/Layout/DaoAdminLayout.jsx

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDaoAuth } from '../../context/DaoAuthContext';
import DaoSidebar from './DaoSidebar';

const DaoAdminLayout = ({ children }) => {
  const { isDaoAdmin, loading } = useDaoAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isDaoAdmin) {
      navigate('/dao-admin/login');
    }
  }, [isDaoAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1">
        <DaoSidebar />
        <main className="ml-64 w-full flex-1 bg-indigo-950">
          <div className="bg-indigo-900 border-b border-indigo-700 px-8 h-14 flex items-center">
            <span className="text-blue-300 font-semibold text-sm tracking-wide">DAO Admin Panel</span>
          </div>
          <div className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DaoAdminLayout;
