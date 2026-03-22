// frontend/src/App.jsx - FIXED VERSION

import React, { useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WalletProvider } from './context/WalletContext';
import ErrorBoundary from './components/ErrorBoundary';
import WalletErrorBoundary from './components/WalletErrorBoundary';

import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';

import Home from './pages/Home';
import Staking from './pages/Staking';
import Connect from './pages/Connect';

import AdminDashboard from './pages/Admin/Dashboard';
import AdminCollections from './pages/Admin/Collections';
import AdminRewards from './pages/Admin/Rewards';
import AdminTraits from './pages/Admin/Traits';
import AdminFees from './pages/Admin/Fees';
import AdminManagers from './pages/Admin/Admins';
import AdminWallet from './pages/Admin/Wallet';
import AdminSettings from './pages/Admin/Settings';
import AdminProfile from './pages/Admin/Profile';
import AdminLogin from './pages/Admin/Login';

import PrivateRoute from './components/Auth/PrivateRoute';
import AdminRoute from './components/Auth/AdminRoute';

// FIXED: Memoize LayoutWrapper to prevent unnecessary re-renders
const LayoutWrapper = React.memo(({ children }) => {
  const location = useLocation();

  // FIXED: Memoize the admin route check to prevent recalculation on every render
  const isAdminRoute = useMemo(() => {
    return location.pathname.startsWith('/admin');
  }, [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen">
      {!isAdminRoute && <Navbar />}
      <main className="flex-grow bg-gray-100">{children}</main>
      {!isAdminRoute && <Footer />}
    </div>
  );
});

// Set display name for debugging
LayoutWrapper.displayName = 'LayoutWrapper';

function App() {
  return (
    <ErrorBoundary title="Application Error" showHomeButton={true}>
      <AuthProvider>
        <WalletErrorBoundary>
          <WalletProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <LayoutWrapper>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/connect" element={<Connect />} />
                  <Route path="/admin/login" element={<AdminLogin />} />

                  {/* Protected Routes */}
                  <Route
                    path="/staking"
                    element={
                      <PrivateRoute>
                        <Staking />
                      </PrivateRoute>
                    }
                  />

                  {/* Admin Routes */}
                  <Route
                    path="/admin"
                    element={
                      <AdminRoute>
                        <AdminDashboard />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/collections"
                    element={
                      <AdminRoute>
                        <AdminCollections />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/rewards"
                    element={
                      <AdminRoute>
                        <AdminRewards />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/traits"
                    element={
                      <AdminRoute>
                        <AdminTraits />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/fees"
                    element={
                      <AdminRoute>
                        <AdminFees />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/admins"
                    element={
                      <AdminRoute>
                        <AdminManagers />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/wallet"
                    element={
                      <AdminRoute>
                        <AdminWallet />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/settings"
                    element={
                      <AdminRoute>
                        <AdminSettings />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/profile"
                    element={
                      <AdminRoute>
                        <AdminProfile />
                      </AdminRoute>
                    }
                  />
                </Routes>
              </LayoutWrapper>
            </Router>
          </WalletProvider>
        </WalletErrorBoundary>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;