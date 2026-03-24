// frontend/src/components/Layout/Sidebar.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { isAdmin, isSuperAdmin, logout } = useAuth();
  const location = useLocation();

  if (!isAdmin) return null;

  const link = (to, label) => (
    <Link
      key={to}
      to={to}
      className={`block px-4 py-2 rounded-lg text-sm transition-all ${
        location.pathname === to
          ? 'bg-green-500 text-black font-semibold shadow-[0_0_10px_rgba(34,197,94,0.3)]'
          : 'text-green-700 hover:text-green-400 hover:bg-[#1e3a1e]/40'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="h-screen w-64 bg-[#0d1a0d] border-r border-[#1e3a1e] text-white fixed left-0 top-0 pt-4">
      <div className="px-4 mb-6">
        <div className="text-green-400 font-bold text-lg tracking-wide">PEPE GODS</div>
        <div className="text-green-700 text-xs">Admin Panel</div>
      </div>
      <nav className="px-3 space-y-1">
        {link('/admin', 'Dashboard')}
        {link('/admin/collections', 'Collections')}
        {link('/admin/rewards', 'Rewards')}
        {link('/admin/traits', 'Trait Rewards')}
        {link('/admin/fees', 'Fees')}
        {link('/admin/airdrops', 'Airdrops')}
        {link('/admin/analytics/claims', 'Claims Analytics')}
        {link('/admin/analytics/airdrop-claims', 'Airdrop Analytics')}
        {isSuperAdmin && link('/admin/admins', 'Admin Managers')}
        {isSuperAdmin && link('/admin/wallet', 'Wallet Setup')}
        {link('/admin/settings', 'Settings')}
        {link('/admin/profile', 'Profile')}
        <button
          onClick={logout}
          className="block w-full text-left px-4 py-2 rounded-lg text-sm text-red-500 hover:text-red-400 hover:bg-[#1e3a1e]/40 transition-all mt-4"
        >
          Logout
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;
