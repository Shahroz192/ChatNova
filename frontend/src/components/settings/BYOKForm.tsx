import React, { useState, useEffect, useCallback, useMemo } from "react";
import { X, FloppyDisk, Trash } from "@phosphor-icons/react";
import api from "../../utils/api";

const BYOKForm: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<{ [key: string]: string }>({});
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState<{ [key: string]: boolean }>({});
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const providers = useMemo(() => ["Google", "Cerebras", "Groq"], []);

  const fetchAvailableProviders = useCallback(async () => {
    try {
      const response = await api.get("/users/me/api-keys");
      setAvailableProviders(response.data.map((key: { model_name: string }) => key.model_name));
    } catch (error) {
      console.error("Failed to fetch saved API keys", error);
    }
  }, []);

  useEffect(() => {
    fetchAvailableProviders();
  }, [fetchAvailableProviders]);

  const handleKeyChange = useCallback((provider: string, key: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: key }));
  }, []);

  const handleTestKey = useCallback(async (provider: string) => {
    const key = apiKeys[provider];
    if (!key) return;
    setIsTesting((prev) => ({ ...prev, [provider]: true }));
    try {
      await api.post(`/chat/models/test/${provider}`, { api_key: key });
      setNotification({ type: "success", message: `${provider} API key is valid!` });
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || "Unknown error";
      setNotification({ type: "error", message: `Invalid ${provider} API key: ${errorMsg}` });
    } finally {
      setIsTesting((prev) => ({ ...prev, [provider]: false }));
    }
  }, [apiKeys]);

  const handleSaveKey = useCallback(async (provider: string) => {
    const key = apiKeys[provider];
    if (!key) return;
    try {
      await api.post("/users/me/api-keys", { model_name: provider, api_key: key });
      setNotification({ type: "success", message: `API key for ${provider} saved successfully!` });
      setApiKeys((prev) => ({ ...prev, [provider]: "" }));
      fetchAvailableProviders();
    } catch {
      setNotification({ type: "error", message: `Failed to save key for ${provider}.` });
    }
  }, [apiKeys, fetchAvailableProviders]);

  const handleDeleteKey = useCallback(async (provider: string) => {
    if (!window.confirm(`Are you sure you want to delete the ${provider} API key?`)) return;
    try {
      await api.delete(`/users/me/api-keys/${provider}`);
      setNotification({ type: "success", message: `API key for ${provider} deleted.` });
      fetchAvailableProviders();
    } catch {
      setNotification({ type: "error", message: `Failed to delete key for ${provider}.` });
    }
  }, [fetchAvailableProviders]);

  const handleCloseNotification = useCallback(() => setNotification(null), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {providers.map((provider) => {
        const hasKey = availableProviders.includes(provider);
        return (
          <div key={provider} className="settings-provider-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
            {hasKey && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent, #059669)', flexShrink: 0 }} />
            )}
            <span className="settings-provider-name" style={{ whiteSpace: 'nowrap', minWidth: 80 }}>{provider}</span>
            <input
              type="password"
              value={hasKey ? "••••••••" : (apiKeys[provider] || "")}
              onChange={(e) => handleKeyChange(provider, e.target.value)}
              className="settings-input"
              placeholder={hasKey ? "Key saved — delete to change" : "Enter your API key..."}
              disabled={hasKey}
              autoComplete="one-time-code"
              style={{ fontSize: '0.8125rem', flex: 1, minWidth: 0 }}
            />
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {hasKey ? (
                <button
                  onClick={() => handleDeleteKey(provider)}
                  className="settings-btn settings-btn-danger"
                  title="Delete API key"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                >
                  <Trash size={14} />
                  Delete
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleTestKey(provider)}
                    disabled={isTesting[provider] || !apiKeys[provider]}
                    className="settings-btn settings-btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                  >
                    {isTesting[provider] ? "Testing..." : "Test"}
                  </button>
                  <button
                    onClick={() => handleSaveKey(provider)}
                    disabled={!apiKeys[provider]}
                    className="settings-btn settings-btn-success"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                  >
                    <FloppyDisk size={14} />
                    Save
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {notification && (
        <div
          className={`settings-alert ${notification.type === 'success' ? 'settings-alert-success' : 'settings-alert-error'}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span>{notification.message}</span>
          <button
            onClick={handleCloseNotification}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(BYOKForm);
