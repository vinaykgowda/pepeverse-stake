import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

export const DaoAuthContext = createContext();

export const useDaoAuth = () => useContext(DaoAuthContext);

export const DaoAuthProvider = ({ children }) => {
  const [daoUser, setDaoUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDaoAdmin, setIsDaoAdmin] = useState(false);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem('daoAdminToken');
      const userJson = localStorage.getItem('daoAdminUser');
      if (token && userJson) {
        const parsed = JSON.parse(userJson);
        setDaoUser(parsed);
        setIsDaoAdmin(true);
      }
    } catch (err) {
      console.error('Error restoring DAO admin session:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const daoAdminLogin = useCallback(async (username, password) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/v1/dao-admin/login', { username, password });
      const { token, user } = response.data;

      localStorage.setItem('daoAdminToken', token);
      localStorage.setItem('daoAdminUser', JSON.stringify(user));

      setDaoUser(user);
      setIsDaoAdmin(true);

      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid username or password';
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const daoAdminLogout = useCallback(() => {
    localStorage.removeItem('daoAdminToken');
    localStorage.removeItem('daoAdminUser');
    setDaoUser(null);
    setIsDaoAdmin(false);
    window.location.href = '/dao-admin/login';
  }, []);

  const contextValue = useMemo(() => ({
    daoUser,
    loading,
    isDaoAdmin,
    daoAdminLogin,
    daoAdminLogout,
  }), [daoUser, loading, isDaoAdmin, daoAdminLogin, daoAdminLogout]);

  return (
    <DaoAuthContext.Provider value={contextValue}>
      {children}
    </DaoAuthContext.Provider>
  );
};

export default DaoAuthContext;
