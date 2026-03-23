// frontend/src/components/Layout/Sidebar.jsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { isAdmin, isSuperAdmin, logout } = useAuth();

  const location = useLocation();

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="h-screen w-64 bg-gray-800 text-white fixed left-0 top-0 pt-16">
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-6">Admin Panel</h2>

        <nav className="space-y-2">
          <Link
            to="/admin"
            className={`block px-4 py-2 rounded ${
              location.pathname === '/admin'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Dashboard
          </Link>

          <Link
            to="/admin/collections"
            className={`block px-4 py-2 rounded ${
              location.pathname === '/admin/collections'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Collections
          </Link>

          <Link
            to="/admin/rewards"
            className={`block px-4 py-2 rounded ${
              location.pathname === '/admin/rewards'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Rewards
          </Link>

          <Link
            to="/admin/traits"
            className={`block px-4 py-2 rounded ${
              location.pathname === '/admin/traits'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Trait Rewards
          </Link>

          <Link
            to="/admin/fees"
            className={`block px-4 py-2 rounded ${
              location.pathname === '/admin/fees'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Fees
          </Link>

          {isSuperAdmin && (
            <>
              <Link
                to="/admin/admins"
                className={`block px-4 py-2 rounded ${
                  location.pathname === '/admin/admins'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Admin Managers
              </Link>

              <Link
                to="/admin/wallet"
                className={`block px-4 py-2 rounded ${
                  location.pathname === '/admin/wallet'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                Wallet Setup
              </Link>
            </>
          )}

          <Link
            to="/admin/settings"
            className={`block px-4 py-2 rounded ${
              location.pathname === '/admin/settings'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Settings
          </Link>

          <Link
            to="/admin/airdrops"
            className={`block px-4 py-2 rounded ${
              location.pathname === '/admin/airdrops'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Airdrops
          </Link>

          <Link
            to="/admin/analytics/claims"
            className={`block px-4 py-2 rounded ${
              location.pathname === '/admin/analytics/claims'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Claims Analytics
          </Link>

          <Link
            to="/admin/analytics/airdrop-claims"
            className={`block px-4 py-2 rounded ${
              location.pathname === '/admin/analytics/airdrop-claims'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Airdrop Analytics
          </Link>

          <Link
            to="/admin/profile"
            className={`block px-4 py-2 rounded ${
              location.pathname === '/admin/profile'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            Profile
          </Link>

          <button onClick={logout}
                      className="block w-full text-left px-4 py-2 rounded text-red-400 hover:bg-gray-700"
                    >
                      Logout
                    </button>
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;