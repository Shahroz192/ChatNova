import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { useToast } from "../contexts/ToastContext";

export const useChatModels = () => {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => {
    const saved = localStorage.getItem("selectedModel");
    return saved || "";
  });
  const { error: showError } = useToast();

  const loadModels = useCallback(async () => {
    try {
      const [modelsRes, keysRes] = await Promise.all([
        api.get("/chat/models"),
        api.get("/users/me/api-keys"),
      ]);

      const availableModels = modelsRes.data.models;
      const activeProviders = keysRes.data.map((k: any) =>
        k.model_name.toLowerCase(),
      );

      const filteredModels = availableModels.filter((model: string) => {
        const lowerModel = model.toLowerCase();
        if (lowerModel.includes("gemini") || lowerModel.includes("google")) {
          return activeProviders.includes("google");
        }
        if (lowerModel.includes("zai-glm") || lowerModel.includes("cerebras")) {
          return activeProviders.includes("cerebras");
        }
        if (
          lowerModel.includes("groq") ||
          lowerModel.includes("llama") ||
          lowerModel.includes("mixtral") ||
          lowerModel.includes("kimi")
        ) {
          return activeProviders.includes("groq");
        }
        return true;
      });

      setModels(filteredModels);
      if (
        filteredModels.length > 0 &&
        !filteredModels.includes(selectedModel)
      ) {
        setSelectedModel(filteredModels[0]);
      }
    } catch (error) {
      showError("Failed to load models");
      console.error("Failed to load models", error);
    }
  }, [selectedModel, showError]);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedModel", selectedModel);
  }, [selectedModel]);

  return {
    models,
    selectedModel,
    setSelectedModel,
    loadModels,
  };
};
