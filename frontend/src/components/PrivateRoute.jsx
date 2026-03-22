import React from 'react';
import { Navigate } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';

const PrivateRoute = React.memo(({ children }) => {
  const { connected, loading } = useWallet();

  // Show loading spinner while checking connection
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // If not connected, redirect to connect page
  if (!connected) {
    return <Navigate to="/connect" replace />;
  }

  // If connected, render the protected component
  return children;
});

PrivateRoute.displayName = 'PrivateRoute';

export default PrivateRoute;