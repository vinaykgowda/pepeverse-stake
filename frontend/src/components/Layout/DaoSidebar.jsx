// frontend/src/components/Layout/DaoSidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useDaoAuth } from '../../context/DaoAuthContext';

const DaoSidebar = () => {
  const { isDaoAdmin, daoAdminLogout } = useDaoAuth();

  if (!isDaoAdmin) return null;

  const navLinkClass = ({ isActive }) =>
    `block px-4 py-2 rounded-lg text-sm transition-all ${
      isActive
        ? 'bg-blue-500 text-white font-semibold shadow-[0_0_10px_rgba(99,102,241,0.4)]'
        : 'text-indigo-300 hover:text-blue-200 hover:bg-indigo-800/40'
    }`;

  return (
    <div className="h-screen w-64 bg-indigo-950 border-r border-indigo-800 text-white fixed left-0 top-0 pt-4">
      <div className="px-4 mb-6">
        <div className="text-blue-400 font-bold text-lg tracking-wide">PEPE GODS</div>
        <div className="text-indigo-400 text-xs">DAO Admin Panel</div>
      </div>
      <nav className="px-3 space-y-1">
        <NavLink to="/dao-admin" end className={navLinkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/dao-admin/traits" className={navLinkClass}>
          DAO Traits
        </NavLink>
        <NavLink to="/dao-admin/airdrops" className={navLinkClass}>
          DAO Airdrops
        </NavLink>
        <NavLink to="/dao-admin/analytics/claims" className={navLinkClass}>
          Claims Analytics
        </NavLink>
        <NavLink to="/dao-admin/analytics/airdrop-claims" className={navLinkClass}>
          Airdrop Analytics
        </NavLink>
        <NavLink to="/dao-admin/rewards-breakdown" className={navLinkClass}>
          Rewards Breakdown
        </NavLink>
        <NavLink to="/dao-admin/wallet" className={navLinkClass}>
          Wallet
        </NavLink>
        <NavLink to="/dao-admin/settings" className={navLinkClass}>
          Settings
        </NavLink>
        <NavLink to="/dao-admin/admins" className={navLinkClass}>
          Admins
        </NavLink>
        <button
          onClick={daoAdminLogout}
          className="block w-full text-left px-4 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-indigo-800/40 transition-all mt-4"
        >
          Logout
        </button>
      </nav>
    </div>
  );
};

export default DaoSidebar;
