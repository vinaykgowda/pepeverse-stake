// frontend/src/App.jsx
import React, { useMemo, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WalletProvider } from './context/WalletContext';
import { DaoAuthProvider } from './context/DaoAuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import WalletErrorBoundary from './components/WalletErrorBoundary';

import Navbar from './components/Layout/Navbar';

import Staking from './pages/Staking';

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
import AdminAirdrops from './pages/Admin/Airdrops';
import AdminClaimsAnalytics from './pages/Admin/ClaimsAnalytics';
import AdminRewardsBreakdown from './pages/Admin/RewardsBreakdown';
import AdminAirdropAnalytics from './pages/Admin/AirdropAnalytics';

import PrivateRoute from './components/Auth/PrivateRoute';
import AdminRoute from './components/Auth/AdminRoute';
import DaoAdminRoute from './components/Auth/DaoAdminRoute';

// DAO Admin pages — lazy loaded (pages created in Tasks 17-35)
const DaoLogin = React.lazy(() => import('./pages/DaoAdmin/Login'));
const DaoDashboard = React.lazy(() => import('./pages/DaoAdmin/Dashboard'));
const DaoTraits = React.lazy(() => import('./pages/DaoAdmin/Traits'));
const DaoAirdrops = React.lazy(() => import('./pages/DaoAdmin/Airdrops'));
const DaoClaimsAnalytics = React.lazy(() => import('./pages/DaoAdmin/ClaimsAnalytics'));
const DaoAirdropAnalytics = React.lazy(() => import('./pages/DaoAdmin/AirdropAnalytics'));
const DaoRewardsBreakdown = React.lazy(() => import('./pages/DaoAdmin/RewardsBreakdown'));
const DaoWallet = React.lazy(() => import('./pages/DaoAdmin/Wallet'));
const DaoSettings = React.lazy(() => import('./pages/DaoAdmin/Settings'));
const DaoAdmins = React.lazy(() => import('./pages/DaoAdmin/Admins'));

const LayoutWrapper = React.memo(({ children }) => {
  const location = useLocation();
  const isAdminRoute = useMemo(
    () => location.pathname.startsWith('/admin') || location.pathname.startsWith('/dao-admin'),
    [location.pathname]
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f0a]">
      {!isAdminRoute && <Navbar />}
      <main className="flex-grow">{children}</main>
    </div>
  );
});
LayoutWrapper.displayName = 'LayoutWrapper';

function App() {
  return (
    <ErrorBoundary title="Application Error" showHomeButton={true}>
      <AuthProvider>
        <WalletErrorBoundary>
          <WalletProvider>
            <DaoAuthProvider>
              <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <LayoutWrapper>
                  <Routes>
                    {/* Home = wallet connect / staking */}
                    <Route path="/" element={
                      <PrivateRoute>
                        <Staking />
                      </PrivateRoute>
                    } />
                    <Route path="/staking" element={<Navigate to="/" replace />} />
                    <Route path="/connect" element={<Navigate to="/" replace />} />
                    <Route path="/admin/login" element={<AdminLogin />} />

                    {/* Admin Routes */}
                    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                    <Route path="/admin/collections" element={<AdminRoute><AdminCollections /></AdminRoute>} />
                    <Route path="/admin/rewards" element={<AdminRoute><AdminRewards /></AdminRoute>} />
                    <Route path="/admin/traits" element={<AdminRoute><AdminTraits /></AdminRoute>} />
                    <Route path="/admin/fees" element={<AdminRoute><AdminFees /></AdminRoute>} />
                    <Route path="/admin/admins" element={<AdminRoute><AdminManagers /></AdminRoute>} />
                    <Route path="/admin/wallet" element={<AdminRoute><AdminWallet /></AdminRoute>} />
                    <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                    <Route path="/admin/profile" element={<AdminRoute><AdminProfile /></AdminRoute>} />
                    <Route path="/admin/airdrops" element={<AdminRoute><AdminAirdrops /></AdminRoute>} />
                    <Route path="/admin/analytics/claims" element={<AdminRoute><AdminClaimsAnalytics /></AdminRoute>} />
                    <Route path="/admin/analytics/airdrop-claims" element={<AdminRoute><AdminAirdropAnalytics /></AdminRoute>} />
                    <Route path="/admin/rewards-breakdown" element={<AdminRoute><AdminRewardsBreakdown /></AdminRoute>} />

                    {/* DAO Admin Routes */}
                    <Route path="/dao-admin/login" element={
                      <Suspense fallback={null}>
                        <DaoLogin />
                      </Suspense>
                    } />
                    <Route path="/dao-admin" element={
                      <DaoAdminRoute>
                        <Suspense fallback={null}>
                          <DaoDashboard />
                        </Suspense>
                      </DaoAdminRoute>
                    } />
                    <Route path="/dao-admin/traits" element={
                      <DaoAdminRoute>
                        <Suspense fallback={null}>
                          <DaoTraits />
                        </Suspense>
                      </DaoAdminRoute>
                    } />
                    <Route path="/dao-admin/airdrops" element={
                      <DaoAdminRoute>
                        <Suspense fallback={null}>
                          <DaoAirdrops />
                        </Suspense>
                      </DaoAdminRoute>
                    } />
                    <Route path="/dao-admin/analytics/claims" element={
                      <DaoAdminRoute>
                        <Suspense fallback={null}>
                          <DaoClaimsAnalytics />
                        </Suspense>
                      </DaoAdminRoute>
                    } />
                    <Route path="/dao-admin/analytics/airdrop-claims" element={
                      <DaoAdminRoute>
                        <Suspense fallback={null}>
                          <DaoAirdropAnalytics />
                        </Suspense>
                      </DaoAdminRoute>
                    } />
                    <Route path="/dao-admin/rewards-breakdown" element={
                      <DaoAdminRoute>
                        <Suspense fallback={null}>
                          <DaoRewardsBreakdown />
                        </Suspense>
                      </DaoAdminRoute>
                    } />
                    <Route path="/dao-admin/wallet" element={
                      <DaoAdminRoute>
                        <Suspense fallback={null}>
                          <DaoWallet />
                        </Suspense>
                      </DaoAdminRoute>
                    } />
                    <Route path="/dao-admin/settings" element={
                      <DaoAdminRoute>
                        <Suspense fallback={null}>
                          <DaoSettings />
                        </Suspense>
                      </DaoAdminRoute>
                    } />
                    <Route path="/dao-admin/admins" element={
                      <DaoAdminRoute>
                        <Suspense fallback={null}>
                          <DaoAdmins />
                        </Suspense>
                      </DaoAdminRoute>
                    } />
                  </Routes>
                </LayoutWrapper>
              </Router>
            </DaoAuthProvider>
          </WalletProvider>
        </WalletErrorBoundary>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
