import React, { useState, useEffect, useCallback } from 'react';
import { PencilSimple, Trash, FloppyDisk, X, CheckCircle, WarningCircle, HardDrives } from '@phosphor-icons/react';
import api from '../../utils/api';

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
    } catch {
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
    } catch {
      setValidationError('Invalid JSON format');
      return false;
    }
  }, []);

  const handleEdit = useCallback((server: MCPServer) => {
    setEditingServer(server.id);
    setEditConfig(server.mcp_servers_config);
    setValidationError('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!validateConfig(editConfig)) return;

    setIsSaving(true);
    try {
      await api.post('/users/me/mcp-servers', { mcp_servers_config: editConfig });
      setEditingServer(null);
      setValidationError('');
      setNotification({ type: 'success', message: 'Servers updated successfully!' });
      fetchServers();
    } catch (apiError: any) {
      setNotification({ type: 'error', message: apiError.response?.data?.detail || 'Failed to update servers.' });
    } finally {
      setIsSaving(false);
    }
  }, [editConfig, validateConfig, fetchServers]);

  const handleRemove = useCallback(async () => {
    if (!window.confirm('Are you sure you want to remove all MCP servers?')) return;

    setIsDeleting(true);
    try {
      await api.delete('/users/me/mcp-servers');
      setNotification({ type: 'success', message: 'Servers removed successfully!' });
      fetchServers();
    } catch (error: any) {
      setNotification({ type: 'error', message: error.response?.data?.detail || 'Failed to remove servers.' });
    } finally {
      setIsDeleting(false);
    }
  }, [fetchServers]);

  const handleCloseNotification = useCallback(() => setNotification(null), []);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{
          width: 24, height: 24,
          border: '2px solid var(--border-light, #e8e5df)',
          borderTopColor: 'var(--text-primary, #1c1917)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px'
        }} />
        <p className="settings-hint" style={{ margin: 0 }}>Loading servers...</p>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="settings-empty">
        <div className="settings-empty-icon">
          <HardDrives size={40} weight="light" />
        </div>
        <p className="settings-empty-title">No MCP Servers Configured</p>
        <p className="settings-empty-desc">Add your first server using the button above.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {servers.map((server) => (
        <div key={server.id} className="settings-server-card">
          {editingServer === server.id ? (
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <PencilSimple size={18} style={{ color: 'var(--text-secondary, #78716c)' }} />
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #1c1917)', margin: 0 }}>
                  Edit Configuration
                </h4>
              </div>

              <textarea
                value={editConfig}
                onChange={(e) => {
                  setEditConfig(e.target.value);
                  if (validationError && e.target.value.trim()) {
                    validateConfig(e.target.value);
                  }
                }}
                className="settings-textarea"
                style={{
                  minHeight: 180,
                  fontFamily: 'var(--font-family-mono, monospace)',
                  fontSize: '0.8125rem',
                  borderColor: validationError ? 'var(--error, #ef4444)' : undefined,
                }}
                disabled={isSaving}
              />

              {validationError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--error, #ef4444)', fontSize: '0.8125rem' }}>
                  <WarningCircle size={16} weight="bold" />
                  {validationError}
                </div>
              )}

              {!validationError && editConfig.trim() && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--text-secondary, #78716c)', fontSize: '0.8125rem' }}>
                  <CheckCircle size={16} weight="bold" />
                  Valid configuration
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => { setEditingServer(null); setValidationError(''); }}
                  disabled={isSaving}
                  className="settings-btn settings-btn-secondary"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editConfig.trim() || !!validationError}
                  className="settings-btn settings-btn-success"
                >
                  {isSaving ? 'Saving...' : <><FloppyDisk size={16} /> Save Changes</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="settings-server-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #1c1917)', margin: '0 0 4px' }}>
                  MCP Server Configuration
                </h4>

                <details className="settings-server-details" style={{ marginTop: 8 }}>
                  <summary className="settings-server-summary">
                    <HardDrives size={14} />
                    Show Configuration
                  </summary>
                  <div className="settings-server-config">
                    <pre className="settings-server-pre">{server.mcp_servers_config}</pre>
                  </div>
                </details>

                {server.servers && Object.keys(server.servers).length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.keys(server.servers).map(serverName => (
                      <span
                        key={serverName}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          background: 'var(--bg-tertiary, #e8e5df)',
                          color: 'var(--text-secondary, #78716c)',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          fontFamily: 'var(--font-family-mono, monospace)',
                        }}
                      >
                        {serverName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="settings-server-meta">
                <span className={`settings-badge ${
                  server.status === 'connected' ? 'settings-badge-success' :
                  server.status === 'loading' ? 'settings-badge-warning' : 'settings-badge-error'
                }`}>
                  {server.status === 'connected' && <CheckCircle size={12} weight="bold" />}
                  {server.status === 'error' && <WarningCircle size={12} weight="bold" />}
                  {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                </span>
                <div className="settings-server-actions">
                  <button
                    onClick={() => handleEdit(server)}
                    disabled={isDeleting}
                    className="settings-btn settings-btn-primary"
                    style={{ justifyContent: 'center' }}
                  >
                    <PencilSimple size={14} />
                    Edit
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={isDeleting}
                    className="settings-btn settings-btn-danger"
                    style={{ justifyContent: 'center' }}
                  >
                    {isDeleting ? 'Removing...' : <><Trash size={14} /> Remove</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {notification && (
        <div
          className={`settings-alert ${notification.type === 'success' ? 'settings-alert-success' : 'settings-alert-error'}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span>{notification.message}</span>
          <button onClick={handleCloseNotification} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(MCPServerList);
