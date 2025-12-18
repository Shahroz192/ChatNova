import api from './api';

export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const response = await api.get('/users/me');
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

export const getUserInfo = async () => {
  try {
    const response = await api.get('/users/me');
    return response.data;
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout error:', error);
    window.location.href = '/login';
  }
};