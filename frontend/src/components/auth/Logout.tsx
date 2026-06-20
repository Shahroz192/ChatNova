import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const Logout: React.FC = () => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
            navigate('/login');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md mx-4">
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 p-8 text-center">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Logout</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to logout?</p>
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                        >
                            Yes, Logout
                        </button>
                        <button
                            onClick={() => navigate('/chat')}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Logout;