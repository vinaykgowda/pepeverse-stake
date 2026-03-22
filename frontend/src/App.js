// frontend/src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WalletProvider } from './context/WalletContext';

// Pages
import Home from './pages/Home';
import Connect from './pages/Connect';
import Staking from './pages/Staking';

// Admin Pages
import Dashboard from './pages/Admin/Dashboard';
import Collections from './pages/Admin/Collections';
import Rewards from './pages/Admin/Rewards';
import Traits from './pages/Admin/Traits';
import Fees from './pages/Admin/Fees';
import Admins from './pages/Admin/Admins';
import Wallet from './pages/Admin/Wallet';
import Settings from './pages/Admin/Settings';

import AdminLogin from './pages/Admin/Login';

import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Auth Guard
const PrivateRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('token') !== null;

  if (!isAuthenticated) {
    return <Navigate to="/connect" />;
  }

  return children;
};

// Admin Guard
const AdminRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('token') !== null;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.isAdmin === true;

  if (!isAuthenticated) {
    return <Navigate to="/connect" />;
  }

  if (!isAdmin) {
    return <Navigate to="/" />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <WalletProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/connect" element={<Connect />} />

            {/* Private Routes */}
            <Route
              path="/staking"
              element={
                <PrivateRoute>
                  <Staking />
                </PrivateRoute>
              }
            />

            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Dashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/collections"
              element={
                <AdminRoute>
                  <Collections />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/rewards"
              element={
                <AdminRoute>
                  <Rewards />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/traits"
              element={
                <AdminRoute>
                  <Traits />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/fees"
              element={
                <AdminRoute>
                  <Fees />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/admins"
              element={
                <AdminRoute>
                  <Admins />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/wallet"
              element={
                <AdminRoute>
                  <Wallet />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminRoute>
                  <Settings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <AdminRoute>
                  <Profile />
                </AdminRoute>
              }
            />

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </WalletProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;