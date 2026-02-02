import React, { useState, useEffect, useCallback } from 'react';
import { Edit2, Trash2, Save, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../utils/api';
import Notification from '../common/Notification';
import '../../styles/MCPServer.css';

interface MCPServer {
  id: number;
  mcp_servers_config: string;
  servers?: { [key: string]: any };
  status: 'connected' | 'error' | 'loading';
}

const MCPServerList: React.FC = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [editingServer, setEditingServer] = useState<number | null>(null);
  const [editConfig, setEditConfig] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  const fetchServers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/users/me/mcp-servers');
      const servers = response.data.map((s: any) => {
        try {
          const config = JSON.parse(s.mcp_servers_config);
          return { ...s, servers: config.mcpServers || {}, status: 'connected' };
        } catch {
          return { ...s, servers: {}, status: 'error' };
        }
      });
      setServers(servers);
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to load servers.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const validateConfig = useCallback((config: string): boolean => {
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
  }, []);

  const handleEdit = useCallback((server: MCPServer) => {
    setEditingServer(server.id);
    setEditConfig(server.mcp_servers_config);
    setValidationError('');
  }, []);

  const handleConfigChange = useCallback((value: string) => {
    setEditConfig(value);
    if (validationError && value.trim()) {
      validateConfig(value);
    }
  }, [validationError, validateConfig]);

  const handleSaveEdit = useCallback(async () => {
    if (!validateConfig(editConfig)) {
      return;
    }
    
    setIsSaving(true);
    try {
      await api.post('/users/me/mcp-servers', {
        mcp_servers_config: editConfig,
      });
      setNotification({ type: 'success', message: 'Servers updated successfully!' });
      setEditingServer(null);
      setValidationError('');
      fetchServers();
    } catch (apiError: any) {
      const errorMessage = apiError.response?.data?.detail || 'Failed to update servers.';
      setNotification({ type: 'error', message: errorMessage });
    } finally {
      setIsSaving(false);
    }
  }, [editConfig, validateConfig, fetchServers]);

  const handleRemove = useCallback(async () => {
    const confirmed = window.confirm('Are you sure you want to remove all MCP servers? This action cannot be undone.');
    if (!confirmed) return;
    
    setIsDeleting(true);
    try {
      await api.delete('/users/me/mcp-servers');
      setNotification({ type: 'success', message: 'Servers removed successfully!' });
      fetchServers();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to remove servers.';
      setNotification({ type: 'error', message: errorMessage });
    } finally {
      setIsDeleting(false);
    }
  }, [fetchServers]);

  const handleCancelEdit = useCallback(() => {
    setEditingServer(null);
    setEditConfig('');
    setValidationError('');
  }, []);

  const handleCloseNotification = useCallback(() => setNotification(null), []);

  return (
    <div className="space-y-4">
      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-500 mcp-server-loader mr-3" size={24} />
          <span className="text-gray-600 mcp-server-loading-text">Loading servers...</span>
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-secondary-200 mcp-server-empty-state rounded-xl animate-fadeIn">
          <p className="text-secondary-600 mcp-server-empty-text font-medium mb-1">No MCP Servers Configured</p>
          <p className="text-sm text-secondary-500 mcp-server-empty-subtext">Add your first server using the form above!</p>
        </div>
      ) : (
        servers.map((server) => (
          <div key={server.id} className="card mb-lg slide-up">
             {editingServer === server.id ? (
                <div className="space-y-4">
                  <div className="flex items-center mb-2">
                    <Edit2 size={18} className="text-blue-500 mcp-server-edit-icon mr-2" />
                    <h4 className="font-semibold text-gray-800 mcp-server-edit-title">Edit Configuration</h4>
                  </div>
                  
                  <textarea
                    value={editConfig}
                    onChange={(e) => handleConfigChange(e.target.value)}
                    className={`form-control font-mono resize-y min-h-[180px] ${
                      validationError
                        ? 'border-error-500 focus:ring-error-500 focus:border-error-500'
                        : 'focus:ring-primary-500 focus:border-primary-500'
                    } mcp-server-textarea`}
                    placeholder='{"mcpServers": {"server1": {...}, "server2": {...}}}'
                    disabled={isSaving}
                  />
                  
                  {/* Validation feedback */}
                  {validationError ? (
                    <div className="flex items-center text-error-600 mcp-server-validation-error text-sm">
                      <AlertCircle size={16} className="mr-1.5" />
                      {validationError}
                    </div>
                  ) : null}
                  
                  {!validationError && editConfig.trim() ? (
                    <div className="flex items-center text-success-600 mcp-server-validation-success text-sm">
                      <CheckCircle size={16} className="mr-1.5" />
                      Valid configuration
                    </div>
                  ) : null}
                  
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="btn btn-secondary flex items-center"
                    >
                      <X size={16} className="mr-2" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSaving || !editConfig.trim() || !!validationError}
                      className="btn btn-success flex items-center"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={16} />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={16} className="mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start p-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-6">
                        <h4 className="font-semibold text-gray-800 mcp-server-config-title whitespace-nowrap">MCP Server Configuration</h4>
                      </div>
                      
                      <details className="text-sm text-gray-600 mcp-server-details mt-6 group">
                        <summary className="cursor-pointer py-3 px-4 bg-gray-50 mcp-server-summary rounded-lg inline-flex items-center font-medium transition-colors">
                          <span className="group-open:hidden">Show Configuration</span>
                          <span className="hidden group-open:inline">Hide Configuration</span>
                        </summary>
                        <pre className="mt-4 p-5 bg-gray-50 mcp-server-config-pre border border-gray-200 rounded-lg text-xs overflow-auto max-h-48 font-mono leading-relaxed">{server.mcp_servers_config}</pre>
                      </details>
                      
                      {server.servers && Object.keys(server.servers).length > 0 ? (
                        <div className="mt-4 p-3 bg-blue-50 mcp-server-configured-section border border-blue-200 rounded-lg">
                          <p className="text-sm font-semibold text-blue-900 mcp-server-configured-title mb-2">Configured Servers ({Object.keys(server.servers).length})</p>
                          <ul className="space-y-1.5">
                            {Object.keys(server.servers).map(serverName => (
                              <li key={serverName} className="flex items-center text-sm text-blue-800 mcp-server-configured-item">
                                <span className="w-1.5 h-1.5 bg-blue-500 mcp-server-configured-dot rounded-full mr-2"></span>
                                <code className="font-mono text-xs bg-blue-100 mcp-server-configured-code px-2 py-0.5 rounded">{serverName}</code>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                    
                    <div className="flex flex-col items-end space-y-3 ml-6">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                        server.status === 'connected' 
                          ? 'bg-green-100 text-green-800 mcp-server-status-connected border border-green-200' 
                          : server.status === 'loading' 
                          ? 'bg-yellow-100 text-yellow-800 mcp-server-status-loading border border-yellow-200' 
                          : 'bg-red-100 text-red-800 mcp-server-status-error border border-red-200'
                      }`}>
                        {server.status === 'connected' ? <CheckCircle size={14} className="mr-1" /> : null}
                        {server.status === 'error' ? <AlertCircle size={14} className="mr-1" /> : null}
                        {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                      </span>
                      
                      <div className="flex flex-col space-y-2 w-full">
                        <button
                          onClick={() => handleEdit(server)}
                          disabled={isDeleting}
                          className="btn btn-primary flex items-center justify-center"
                        >
                          <Edit2 size={16} className="mr-2" />
                          Edit
                        </button>
                        <button
                          onClick={handleRemove}
                          disabled={isDeleting}
                          className="btn btn-error flex items-center justify-center"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="animate-spin mr-2" size={16} />
                              Removing...
                            </>
                          ) : (
                            <>
                              <Trash2 size={16} className="mr-2" />
                              Remove
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
             )}
           </div>
         ))
       )}
      
      {notification ? (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={handleCloseNotification}
        />
      ) : null}
    </div>
  );
};

export default React.memo(MCPServerList);