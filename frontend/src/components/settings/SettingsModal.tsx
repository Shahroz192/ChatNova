import React, { useState } from 'react';
import BYOKForm from './BYOKForm';
import MCPServerForm from './MCPServerForm';
import MCPServerList from './MCPServerList';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'keys' | 'servers'>('keys');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 md:max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
        <div className="flex mb-4">
          <button
            className={`flex-1 py-2 px-4 ${activeTab === 'keys' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveTab('keys')}
          >
            API Keys
          </button>
          <button
            className={`flex-1 py-2 px-4 ${activeTab === 'servers' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveTab('servers')}
          >
            MCP Servers
          </button>
        </div>
        {activeTab === 'keys' && <BYOKForm />}
        {activeTab === 'servers' && (
          <div>
            <MCPServerList />
            <MCPServerForm />
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;