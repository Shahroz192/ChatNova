import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import Notification from "../common/Notification";
import "../../styles/BYOKForm.css";

const BYOKForm: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<{ [key: string]: string }>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState<{ [key: string]: boolean }>({});
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const models = [
    "gemini-2.5-flash",
    "qwen-3-235b-a22b-instruct-2507",
    "qwen-3-235b-a22b-thinking-2507",
    "moonshotai/kimi-k2-instruct-0905",
  ];

  useEffect(() => {
    fetchAvailableModels();
  }, []);

  const fetchAvailableModels = async () => {
    try {
      const response = await api.get("/chat/models");
      setAvailableModels(response.data.models);
    } catch (error) {
      console.error("Failed to fetch models", error);
    }
  };

  const handleKeyChange = (model: string, key: string) => {
    setApiKeys((prev) => ({ ...prev, [model]: key }));
  };

  const handleTestKey = async (model: string) => {
    const key = apiKeys[model];
    if (!key) return;
    setIsTesting((prev) => ({ ...prev, [model]: true }));
    try {
      const response = await api.post("/users/me/api-keys", {
        model_name: model,
        encrypted_key: key,
      });
      if (response.status === 200) {
        setNotification({
          type: "success",
          message: `API key for ${model} is valid!`,
        });
      } else {
        throw new Error("Invalid key");
      }
    } catch (error) {
      setNotification({
        type: "error",
        message: `Invalid API key for ${model}. Please check and try again.`,
      });
    } finally {
      setIsTesting((prev) => ({ ...prev, [model]: false }));
    }
  };

  const handleSaveKey = async (model: string) => {
    const key = apiKeys[model];
    if (!key) return;
    try {
      await api.post("/users/me/api-keys", {
        model_name: model,
        encrypted_key: key,
      });
      setNotification({
        type: "success",
        message: `API key for ${model} saved successfully!`,
      });
      setApiKeys((prev) => ({ ...prev, [model]: "" }));
    } catch (error) {
      setNotification({
        type: "error",
        message: `Failed to save key for ${model}. Please try again.`,
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
          Enter your API keys for the supported models. Only models with keys
          will be available for selection.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg byok-table-border">
        <table className="w-100 min-w-full byok-table-bg">
          <thead className="byok-table-header">
            <tr>
              <th className="py-3 px-4 byok-table-header-cell text-left text-sm font-semibold byok-table-header-text">
                Provider/Model
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
            {models.map((model) => (
              <tr key={model} className="byok-table-row">
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-medium ${
                        availableModels.includes(model)
                          ? "byok-model-available"
                          : "byok-model-unavailable"
                      }`}
                    >
                      {model}
                    </span>
                    {availableModels.includes(model) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium byok-badge-active">
                        Active
                      </span>
                    )}
                  </div>
                  {!availableModels.includes(model) && (
                    <span className="text-xs byok-model-required block mt-1">
                      Key required
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <input
                    type="password"
                    value={
                      availableModels.includes(model)
                        ? "•••••"
                        : apiKeys[model] || ""
                    }
                    onChange={(e) => handleKeyChange(model, e.target.value)}
                    className="w-full p-2 byok-input-field rounded-lg transition-all"
                    placeholder={
                      availableModels.includes(model) ? "" : "Enter API key..."
                    }
                    disabled={
                      availableModels.includes(model) ||
                      (!availableModels.includes(model) && !apiKeys[model])
                    }
                  />
                </td>
                <td className="py-3 px-4">
                  <div className="d-inline-flex align-items-center gap-2">
                    <button
                      onClick={() => handleTestKey(model)}
                      disabled={isTesting[model] || !apiKeys[model]}
                      className="btn btn-primary"
                    >
                      {isTesting[model] ? "Testing..." : "Test"}
                    </button>
                    <button
                      onClick={() => handleSaveKey(model)}
                      disabled={!apiKeys[model]}
                      className="btn btn-success"
                    >
                      Save
                    </button>
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
