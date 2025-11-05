import React, { useState } from "react";
import { Plus, Server, CheckCircle, AlertCircle } from "lucide-react";
import api from "../../utils/api";
import Notification from "../common/Notification";
import FloatingUI from "../chat/FloatingUI";
import "../../styles/MCPServer.css";

interface MCPServerFormProps {
    onServerAdded?: () => void;
}

const MCPServerForm: React.FC<MCPServerFormProps> = ({ onServerAdded }) => {
  const [mcpServersConfig, setMcpServersConfig] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [validationError, setValidationError] = useState<string>('');

  const validateConfig = (config: string): boolean => {
    setValidationError('');
    
    if (!config.trim()) {
      setValidationError('Configuration is required');
      return false;
    }
    
    try {
      const parsedConfig = JSON.parse(config);
      
      if (!parsedConfig.mcpServers || typeof parsedConfig.mcpServers !== 'object') {
        setValidationError('Must contain "mcpServers" object');
        return false;
      }
      
      if (Object.keys(parsedConfig.mcpServers).length === 0) {
        setValidationError('At least one server must be configured');
        return false;
      }
      
      return true;
    } catch (jsonError) {
      setValidationError('Invalid JSON format');
      return false;
    }
  };

  const handleAddServer = async () => {
    if (!validateConfig(mcpServersConfig)) {
      return;
    }
    
    setIsAdding(true);
    try {
      await api.post('/users/me/mcp-servers', {
        mcp_servers_config: mcpServersConfig,
      });
      setNotification({ type: 'success', message: 'MCP servers configuration added successfully!' });
      setMcpServersConfig('');
      setValidationError('');
      setShowModal(false);
      onServerAdded?.();
    } catch (apiError: any) {
      const errorMessage = apiError.response?.data?.detail || 'Failed to add servers. Please try again.';
      setNotification({ type: 'error', message: errorMessage });
    } finally {
      setIsAdding(false);
    }
  };

  const handleConfigChange = (value: string) => {
    setMcpServersConfig(value);
    if (validationError && value.trim()) {
      validateConfig(value);
    }
  };

  const handleOpenModal = () => {
    setShowModal(true);
    setMcpServersConfig('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setMcpServersConfig('');
  };

  return (
    <div className="mcp-server-form">
      <button
        onClick={handleOpenModal}
        className="btn btn-primary"
      >
        <Plus size={18} />
        Add MCP Server
      </button>
      
      <FloatingUI
        isOpen={showModal}
        onClose={handleCloseModal}
        title="Add MCP Server Configuration"
        position="center"
      >
        <div className="space-y-4">
          {/* Info Banner */}
          <div className="alert alert-info mcp-server-info">
            <div className="flex items-start">
              <Server size={18} className="text-primary-600 mcp-server-icon mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm mcp-server-info-text">
                <p className="font-medium mb-1">Configuration Format</p>
                <p className="text-xs">Provide a JSON configuration with an "mcpServers" object containing your server definitions.</p>
              </div>
            </div>
          </div>

          {/* Textarea with validation */}
          <div className="space-y-2">
            <label className="form-label">
              Server Configuration (JSON)
            </label>
            <textarea
              value={mcpServersConfig}
              onChange={(e) => handleConfigChange(e.target.value)}
              className={`form-control font-mono resize-y min-h-[180px] ${
                validationError
                  ? 'border-error-500 focus:ring-error-500 focus:border-error-500'
                  : 'focus:ring-primary-500 focus:border-primary-500'
              } mcp-server-textarea`}
              placeholder='{"mcpServers": {"sequential-thinking": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"], "env": {}}}}'
              disabled={isAdding}
            />
            
            {/* Validation feedback */}
            {validationError && (
              <div className="flex items-center text-error-600 mcp-server-validation-error text-sm">
                <AlertCircle size={16} className="mr-1.5" />
                {validationError}
              </div>
            )}
            
            {!validationError && mcpServersConfig.trim() && (
              <div className="flex items-center text-success-600 mcp-server-validation-success text-sm">
                <CheckCircle size={16} className="mr-1.5" />
                Valid configuration
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={handleCloseModal}
              disabled={isAdding}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleAddServer}
              disabled={isAdding || !mcpServersConfig.trim() || !!validationError}
              className="btn btn-success flex items-center"
            >
              {isAdding ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="mr-2" />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
      </FloatingUI>
      
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default MCPServerForm;
