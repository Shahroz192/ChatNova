import React, { useState, useCallback } from "react";
import { Plus, HardDrives, CheckCircle, WarningCircle, X, FloppyDisk } from "@phosphor-icons/react";
import api from "../../utils/api";
import FloatingUI from "../chat/FloatingUI";

interface MCPServerFormProps {
    onServerAdded?: () => void;
}

const MCPServerForm: React.FC<MCPServerFormProps> = ({ onServerAdded }) => {
  const [mcpServersConfig, setMcpServersConfig] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [validationError, setValidationError] = useState<string>('');

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

  const handleAddServer = useCallback(async () => {
    if (!validateConfig(mcpServersConfig)) return;

    setIsAdding(true);
    try {
      await api.post('/users/me/mcp-servers', { mcp_servers_config: mcpServersConfig });
      setMcpServersConfig('');
      setValidationError('');
      setShowModal(false);
      setNotification({ type: 'success', message: 'MCP servers configuration added successfully!' });
      onServerAdded?.();
    } catch (apiError: any) {
      const errorMessage = apiError.response?.data?.detail || 'Failed to add servers.';
      setNotification({ type: 'error', message: errorMessage });
    } finally {
      setIsAdding(false);
    }
  }, [mcpServersConfig, validateConfig, onServerAdded]);

  const handleConfigChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMcpServersConfig(value);
    if (validationError && value.trim()) {
      validateConfig(value);
    }
  }, [validationError, validateConfig]);

  const handleCloseNotification = useCallback(() => setNotification(null), []);

  return (
    <div>
      <button onClick={() => setShowModal(true)} className="settings-btn settings-btn-primary">
        <Plus size={16} weight="bold" />
        Add MCP Server
      </button>

      <FloatingUI
        isOpen={showModal}
        onClose={() => { setShowModal(false); setMcpServersConfig(''); }}
        title="Add MCP Server Configuration"
        position="center"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Info banner */}
          <div style={{
            display: 'flex',
            gap: 12,
            padding: '12px 16px',
            background: 'rgba(5, 150, 105, 0.06)',
            border: '1px solid rgba(5, 150, 105, 0.1)',
            borderRadius: 'var(--radius-md)',
          }}>
            <HardDrives size={20} style={{ color: 'var(--accent, #059669)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary, #1c1917)', margin: '0 0 4px' }}>
                Configuration Format
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #78716c)', margin: 0, lineHeight: 1.4 }}>
                Provide a JSON configuration with an "mcpServers" object containing your server definitions.
              </p>
            </div>
          </div>

          <div>
            <label className="settings-label" style={{ marginBottom: 8 }}>Server Configuration (JSON)</label>
            <textarea
              value={mcpServersConfig}
              onChange={handleConfigChange}
              className="settings-textarea"
              style={{
                minHeight: 180,
                fontFamily: 'var(--font-family-mono, monospace)',
                fontSize: '0.8125rem',
                borderColor: validationError ? 'var(--error, #ef4444)' : undefined,
              }}
              placeholder='{"mcpServers": {"sequential-thinking": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"], "env": {}}}}'
              disabled={isAdding}
            />

            {validationError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--error, #ef4444)', fontSize: '0.8125rem' }}>
                <WarningCircle size={16} weight="bold" />
                {validationError}
              </div>
            )}

            {!validationError && mcpServersConfig.trim() && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--accent, #059669)', fontSize: '0.8125rem' }}>
                <CheckCircle size={16} weight="bold" />
                Valid configuration
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => { setShowModal(false); setMcpServersConfig(''); }}
              disabled={isAdding}
              className="settings-btn settings-btn-secondary"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              onClick={handleAddServer}
              disabled={isAdding || !mcpServersConfig.trim() || !!validationError}
              className="settings-btn settings-btn-success"
            >
              {isAdding ? (
                <>Saving...</>
              ) : (
                <><FloppyDisk size={16} /> Save Configuration</>
              )}
            </button>
          </div>
        </div>
      </FloatingUI>

      {notification && (
        <div
          className={`settings-alert ${notification.type === 'success' ? 'settings-alert-success' : 'settings-alert-error'}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}
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

export default React.memo(MCPServerForm);
