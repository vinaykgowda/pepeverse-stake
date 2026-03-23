// frontend/src/context/AuthContext.jsx - FIXED VERSION

import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initUser = () => {
      try {
        const userJson = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (userJson && token) {
          setUser(JSON.parse(userJson));
        }
      } catch (error) {
        console.error('Error initializing user:', error);
        setError('Failed to initialize user');
      } finally {
        setLoading(false);
      }
    };

    initUser();
  }, []);

  // Memoize logout function to prevent recreation
  const logout = useCallback((isTimeout = false) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setUser(null);

    // Regular logout - no timeout redirect
    if (user?.isAdmin) {
      window.location.href = '/admin/login';
    } else {
      window.location.href = '/';
    }
  }, [user?.isAdmin]); // Add dependency

  // 🔒 Inactivity auto logout (30 minutes)
  useEffect(() => {
    const events = ['click', 'keydown', 'mousemove', 'scroll'];
    let timeout;

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        logout(true); // auto logout with timeout flag
      }, 30 * 60 * 1000); // 30 mins
    };

    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [logout]); // Add logout as dependency

  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.auth.adminLogin(credentials.username, credentials.password);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      setUser(response.data.user);

      return { success: true };
    } catch (error) {
      console.error('Error logging in:', error);
      setError(error.response?.data?.message || 'Invalid username or password');
      return { success: false, message: error.response?.data?.message || 'Invalid username or password' };
    } finally {
      setLoading(false);
    }
  }, []);

  // Called by WalletContext after wallet sign-in to sync user state
  const setWalletUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Memoize context value
  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin || false,
    isSuperAdmin: user?.isSuperAdmin || false,
    login,
    logout,
    setWalletUser,
    clearError
  }), [user, loading, error, login, logout, setWalletUser, clearError]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;