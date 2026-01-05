import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import Notification from "../common/Notification";
import "../../styles/BYOKForm.css";

const BYOKForm: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<{ [key: string]: string }>({});
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState<{ [key: string]: boolean }>({});
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const providers = [
    "Google",
    "Cerebras",
    "Groq",
  ];

  useEffect(() => {
    fetchAvailableProviders();
  }, []);

  const fetchAvailableProviders = async () => {
    try {
      const response = await api.get("/users/me/api-keys");
      setAvailableProviders(response.data.map((key: { model_name: string }) => key.model_name));
    } catch (error) {
      console.error("Failed to fetch saved API keys", error);
    }
  };

  const handleKeyChange = (provider: string, key: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: key }));
  };

  const handleTestKey = async (provider: string) => {
    const key = apiKeys[provider];
    if (!key) return;
    setIsTesting((prev) => ({ ...prev, [provider]: true }));
    try {
      await api.post(`/chat/models/test/${provider}`, {
        api_key: key,
      });
      setNotification({
        type: "success",
        message: `${provider} API key is valid!`,
      });
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || "Unknown error";
      setNotification({
        type: "error",
        message: `Invalid ${provider} API key: ${errorMsg}`,
      });
    } finally {
      setIsTesting((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleSaveKey = async (provider: string) => {
    const key = apiKeys[provider];
    if (!key) return;
    try {
      await api.post("/users/me/api-keys", {
        model_name: provider, // Using 'model_name' field to store provider
        encrypted_key: key,
      });
      setNotification({
        type: "success",
        message: `API key for ${provider} saved successfully!`,
      });
      setApiKeys((prev) => ({ ...prev, [provider]: "" }));
      fetchAvailableProviders();
    } catch (error) {
      setNotification({
        type: "error",
        message: `Failed to save key for ${provider}. Please try again.`,
      });
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (!window.confirm(`Are you sure you want to delete the ${provider} API key?`)) {
      return;
    }
    try {
      await api.delete(`/users/me/api-keys/${provider}`);
      setNotification({
        type: "success",
        message: `API key for ${provider} deleted successfully.`,
      });
      fetchAvailableProviders();
    } catch (error) {
      setNotification({
        type: "error",
        message: `Failed to delete key for ${provider}. Please try again.`,
      });
    }
  };

  return (
    <div className="byok-form space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 byok-text-color mb-2">
          Manage API Keys
        </h3>
        <p className="text-sm text-gray-600 byok-text-color">
          Enter your API keys for the supported providers. All models from a provider will be unlocked.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg byok-table-border">
        <table className="w-100 min-w-full byok-table-bg">
          <thead className="byok-table-header">
            <tr>
              <th className="py-3 px-4 byok-table-header-cell text-left text-sm font-semibold byok-table-header-text">
                Provider
              </th>
              <th className="py-3 px-4 byok-table-header-cell text-left text-sm font-semibold byok-table-header-text">
                API Key
              </th>
              <th className="py-3 px-4 byok-table-header-cell text-left text-sm font-semibold byok-table-header-text">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="byok-table-body">
            {providers.map((provider) => (
              <tr key={provider} className="byok-table-row">
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-medium ${availableProviders.includes(provider)
                          ? "byok-model-available"
                          : "byok-model-unavailable"
                        }`}
                    >
                      {provider}
                    </span>
                    {availableProviders.includes(provider) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium byok-badge-active">
                        Active
                      </span>
                    )}
                  </div>
                  {!availableProviders.includes(provider) && (
                    <span className="text-xs byok-model-required block mt-1">
                      Key required
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <input
                    type="password"
                    value={
                      availableProviders.includes(provider)
                        ? "•••••"
                        : apiKeys[provider] || ""
                    }
                    onChange={(e) => handleKeyChange(provider, e.target.value)}
                    className="w-full p-2 byok-input-field rounded-lg transition-all"
                    placeholder={
                      availableProviders.includes(provider) ? "Key saved" : "Enter API key..."
                    }
                    disabled={availableProviders.includes(provider)}
                  />
                </td>
                <td className="py-3 px-4">
                  <div className="d-inline-flex align-items-center gap-2">
                    {availableProviders.includes(provider) ? (
                      <>
                        <button
                          onClick={() => handleDeleteKey(provider)}
                          className="btn btn-danger"
                          title="Delete API key"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleTestKey(provider)}
                          disabled={isTesting[provider] || !apiKeys[provider]}
                          className="btn btn-primary"
                        >
                          {isTesting[provider] ? "Testing..." : "Test"}
                        </button>
                        <button
                          onClick={() => handleSaveKey(provider)}
                          disabled={!apiKeys[provider]}
                          className="btn btn-success"
                        >
                          Save
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

export default BYOKForm;
