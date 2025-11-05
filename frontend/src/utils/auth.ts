import api from './api';

/**
 * Utility function to check if the user is authenticated
 * by making a request that requires authentication
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    // Make a simple authenticated request to check if the user is logged in
    const response = await api.get('/users/me');
    return response.status === 200;
  } catch (error) {
    // If the request fails (likely due to 401 Unauthorized), the user is not authenticated
    return false;
  }
};

/**
 * Utility function to get user info
 */
export const getUserInfo = async () => {
  try {
    const response = await api.get('/users/me');
    return response.data;
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
};

/**
 * Utility function to logout
 */
export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout');
    // Redirect to login after successful logout
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout error:', error);
    // Still redirect to login even if the API call fails
    window.location.href = '/login';
  }
};