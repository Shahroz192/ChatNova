import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  PaperPlaneRight,
  MagnifyingGlass,
  Globe,
  Spinner,
  Clock,
  Microphone,
  Square,
  Plus,
  X,
  FileText,
  CaretDown,
} from "@phosphor-icons/react";
import type { WebSearchOptions } from "../../types/search";
import { transcribeAudio } from "../../utils/api/chat";

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sendMessage: (images?: string[]) => void;
  loading: boolean;
  isUploadingDocs?: boolean;
  isProcessingDocs?: boolean;
  searchOptions?: WebSearchOptions;
  onSearchOptionsChange?: (options: WebSearchOptions) => void;
  searchSuggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  recentSearches?: string[];
  onRecentSearchSelect?: (query: string) => void;
  selectedModel: string;
  onFileUpload: (file: File, clientId: string) => void;
  pendingDocuments?: { clientId: string; name: string; isUploading: boolean; processingStatus?: string }[];
  onFileRemove?: (clientId: string) => void;
  models?: string[];
  useTools?: boolean;
  onUseToolsChange?: (use: boolean) => void;
  onModelSelect?: (model: string) => void;
  processingDocCount?: number;
}

type RecordingState = "idle" | "recording" | "processing";

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  sendMessage,
  loading,
  isUploadingDocs = false,
  isProcessingDocs = false,
  searchOptions = { search_web: false },
  onSearchOptionsChange,
  searchSuggestions = [],
  onSuggestionSelect,
  recentSearches = [],
  onRecentSearchSelect,
  selectedModel,
  onFileUpload,
  pendingDocuments = [],
  onFileRemove,
  models = [],
  useTools = false,
  onUseToolsChange,
  onModelSelect,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [pendingImages, setPendingImages] = useState<
    { name: string; data: string }[]
  >([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGemini = useMemo(
    () => selectedModel.toLowerCase().includes("gemini"),
    [selectedModel],
  );

  const handleWebSearchToggle = useCallback(() => {
    if (onSearchOptionsChange) {
      onSearchOptionsChange({
        ...searchOptions,
        search_web: !searchOptions.search_web,
      });
    }
  }, [onSearchOptionsChange, searchOptions]);

  const commands = useMemo(
    () => [
      {
        id: "search",
        name: `Search: ${searchOptions.search_web ? "ON" : "OFF"}`,
        icon: <Globe size={14} />,
        action: () => handleWebSearchToggle(),
      },
      {
        id: "tools",
        name: `Tools: ${useTools ? "ON" : "OFF"}`,
        icon: <FileText size={14} />,
        action: () => onUseToolsChange?.(!useTools),
      },
    ],
    [
      searchOptions.search_web,
      useTools,
      onUseToolsChange,
      handleWebSearchToggle,
    ],
  );

  const filteredCommands = useMemo(() => {
    if (!commandFilter) return commands;
    return commands.filter((c) =>
      c.name.toLowerCase().includes(commandFilter.toLowerCase()),
    );
  }, [commands, commandFilter]);

  const formatModelName = useCallback((name: string) => {
    if (!name) return "Model";

    // Exact mapping for the problematic IDs
    const mappings: Record<string, string> = {
      "zai-glm-4.7": "ZAI GLM 4.7",
      "moonshotai/kimi-k2-instruct-0905": "Kimi",
    };

    if (mappings[name]) return mappings[name];

    // Normalize and clean model names
    const modelId = name.toLowerCase();

    if (modelId.includes("zai-glm")) return "ZAI GLM 4.7";
    if (modelId.includes("kimi")) return "Kimi";
    if (modelId.includes("gpt-4o")) return "GPT-4o";
    if (modelId.includes("claude")) return "Claude";
    if (modelId.includes("gemini")) return "Gemini";

    // Fallback: remove common suffixes and take the last part
    const clean =
      name
        .split("/")
        .pop()
        ?.split(":")[0]
        ?.replace(/-instruct.*$|-thinking.*$|-3-235b.*$/i, "") || name;
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;

      // Toggle overflow based on content height
      if (scrollHeight > 200) {
        textareaRef.current.style.overflowY = "auto";
      } else {
        textareaRef.current.style.overflowY = "hidden";
      }
    }
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (onSuggestionSelect) {
        onSuggestionSelect(suggestion);
      }
      setShowSuggestions(false);
    },
    [onSuggestionSelect],
  );

  const handleRecentSearchClick = useCallback(
    (query: string) => {
      if (onRecentSearchSelect) {
        onRecentSearchSelect(query);
      }
      setShowSuggestions(false);
    },
    [onRecentSearchSelect],
  );

  const toggleRecording = useCallback(async () => {
    if (recordingState === "idle") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          setRecordingState("processing");
          const audioBlob = new Blob(chunksRef.current, { type: "audio/wav" });
          try {
            const text = await transcribeAudio(audioBlob);
            setInput((prev: string) => (prev ? `${prev} ${text}` : text));
          } catch (error) {
            console.error("Transcription error:", error);
          } finally {
            setRecordingState("idle");
            setRecordingTime(0);
            mediaRecorder.stream.getTracks().forEach((track) => {
              track.stop();
            });
          }
        };

        mediaRecorder.start();
        setRecordingState("recording");
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    } else if (recordingState === "recording") {
      mediaRecorderRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => {
        track.stop();
      });
    }
  }, [recordingState, setInput]);

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith("image/");

        if (isImage) {
          if (!isGemini) {
            alert(
              "Images are only supported for Gemini models. Please switch model to upload images.",
            );
            continue;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setPendingImages((prev) => [
              ...prev,
              { name: file.name, data: base64 },
            ]);
          };
          reader.readAsDataURL(file);
        } else {
          const clientId =
            globalThis.crypto?.randomUUID?.() ??
            `${file.name}-${Date.now()}-${i}`;
          onFileUpload(file, clientId);
        }
      }

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [isGemini, onFileUpload],
  );

  const removeImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeDoc = useCallback(
    (clientId: string) => {
      onFileRemove?.(clientId);
    },
    [onFileRemove],
  );

  const handleSendMessage = useCallback(() => {
    if (isUploadingDocs) {
      alert("Documents are still uploading. Please wait a moment.");
      return;
    }
    if (isProcessingDocs) {
      alert("Documents are still being processed. Please wait a moment.");
      return;
    }
    const images = pendingImages.map((img) => img.data);
    sendMessage(images);
    setPendingImages([]);
  }, [pendingImages, sendMessage, isUploadingDocs, isProcessingDocs]);

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);

      if (value.startsWith("/")) {
        setShowCommands(true);
        setCommandFilter(value.slice(1));
        setShowSuggestions(false);
        setShowModelDropdown(false);
      } else {
        setShowCommands(false);
        setShowSuggestions(value.length > 0);
      }
    },
    [setInput],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        if (showCommands && filteredCommands.length > 0) {
          e.preventDefault();
          filteredCommands[0].action();
          setShowCommands(false);
          return;
        }
        e.preventDefault();
        handleSendMessage();
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        setShowCommands(false);
        setShowModelDropdown(false);
      }
    },
    [handleSendMessage, showCommands, filteredCommands],
  );

  const handleFocus = useCallback(() => {
    if (input.startsWith("/")) {
      setShowCommands(true);
    } else {
      setShowSuggestions(true);
    }
  }, [input]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setShowSuggestions(false);
      setShowCommands(false);
      setShowModelDropdown(false);
    }, 200);
  }, []);

  return (
    <>
      {/* Attachment Preview */}
      {pendingImages.length > 0 || pendingDocuments.length > 0 ? (
        <div className="attachment-preview-container">
          {pendingImages.map((img, index) => (
            <div key={`img-${index}`} className="attachment-preview-item">
              <img
                src={img.data}
                alt={img.name}
                className="attachment-thumbnail"
              />
              <button
                type="button"
                className="remove-attachment"
                onClick={() => removeImage(index)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {pendingDocuments.map((doc) => (
            <div
              key={doc.clientId}
              className="attachment-preview-item doc-item"
            >
              <FileText size={20} className="icon-muted" />
              <span className="doc-name">
                {doc.name}
                {doc.isUploading ? " (Uploading...)" : ""}
              </span>
              <button
                type="button"
                className="remove-attachment"
                onClick={() => removeDoc(doc.clientId)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {isUploadingDocs ? (
        <div className="bottomsheet-status">Uploading documents…</div>
      ) : isProcessingDocs ? (
        <div className="bottomsheet-status">Processing documents…</div>
      ) : null}

      {recordingState !== "idle" ? (
        <div className="recording-indicator">
          <div className="recording-pulse"></div>
          <span className="recording-text">
            {recordingState === "processing"
              ? "Transcribing..."
              : `Recording ${formatTime(recordingTime)}`}
          </span>
        </div>
      ) : null}

      <div className={`chat-input-container-modern ${recordingState !== "idle" ? "has-recording" : ""}`}>
        {showCommands && filteredCommands.length > 0 && (
          <div className="search-suggestions-container">
            <div className="suggestions-group">
              <div className="suggestions-group-label">Commands</div>
              {filteredCommands.map((command) => (
                <button
                  key={command.id}
                  className="suggestion-row"
                  onClick={() => {
                    command.action();
                    setShowCommands(false);
                  }}
                >
                  <span className="icon-muted">{command.icon}</span>
                  <span>{command.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showSuggestions &&
        !showCommands &&
        (searchSuggestions.length > 0 || recentSearches.length > 0) ? (
          <div className="search-suggestions-container">
            {/* Search suggestions */}
            {searchSuggestions.length > 0 ? (
              <div className="suggestions-group">
                <div className="suggestions-group-label">Suggestions</div>
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="suggestion-row"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <MagnifyingGlass size={14} className="icon-muted" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* Recent searches */}
            {recentSearches.length > 0 ? (
              <div className="suggestions-group">
                <div className="suggestions-group-label">Recent Searches</div>
                {recentSearches.slice(0, 5).map((query, index) => (
                  <button
                    key={index}
                    className="suggestion-row"
                    onClick={() => handleRecentSearchClick(query)}
                  >
                    <Clock size={14} className="icon-muted" />
                    <span>{query}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Unified Input Area */}
        <div
          className={`modern-input-box ${searchOptions.search_web ? "search-mode" : ""} ${recordingState === "recording" ? "recording-active" : ""}`}
        >
          <textarea
            ref={textareaRef}
            className="modern-textarea"
            rows={1}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={
              recordingState === "processing"
                ? "Transcribing..."
                : "Ask anything..."
            }
            disabled={recordingState === "processing"}
            autoComplete="off"
          />

          <div className="input-actions-row">
            <div className="input-actions-left">
              {/* File Upload Button (First) */}
              <div className="onboarding-anchor">
                <button
                  className="action-icon-btn"
                  onClick={handleFileClick}
                  title="Upload files"
                  type="button"
                >
                  <Plus size={18} weight="bold" />
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                multiple
                onChange={handleFileChange}
                accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
              />

              {/* Model Selector (Second) */}
              <div className="model-selector-container onboarding-anchor">
                <button
                  className="model-select-btn"
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  type="button"
                  title="Select model"
                >
                  <span className="model-name-text truncate">
                    {loading ? (
                      <span className="thinking-text-indicator">
                        Thinking...
                      </span>
                    ) : (
                      formatModelName(selectedModel)
                    )}
                  </span>
                  <CaretDown
                    size={14}
                    weight="bold"
                    className={`dropdown-chevron ${showModelDropdown ? "active" : ""}`}
                  />
                </button>

                {showModelDropdown && (
                  <div className="model-dropdown-menu">
                    {models.map((model) => (
                      <button
                        key={model}
                        className={`model-option ${selectedModel === model ? "active" : ""}`}
                        onClick={() => {
                          onModelSelect?.(model);
                          setShowModelDropdown(false);
                        }}
                      >
                        {formatModelName(model)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="onboarding-anchor">
                <button
                  className={`action-icon-btn ${searchOptions.search_web ? "active" : ""}`}
                  onClick={handleWebSearchToggle}
                  title="Toggle web search"
                  type="button"
                >
                  <Globe size={18} weight="bold" />
                </button>
              </div>
            </div>

            <div className="input-actions-right">
              {/* Voice Input (Near Send) */}
              <div className="onboarding-anchor">
                <button
                  className={`action-icon-btn mic-btn ${recordingState === "recording" ? "recording" : ""}`}
                  onClick={toggleRecording}
                  title={
                    recordingState === "idle"
                      ? "Start recording"
                      : "Stop recording"
                  }
                  type="button"
                  disabled={recordingState === "processing"}
                >
                  {recordingState === "recording" ? (
                    <Square size={18} weight="bold" />
                  ) : (
                    <Microphone size={18} weight="bold" />
                  )}
                </button>
              </div>

              {/* Send Button */}
              <div className="onboarding-anchor">
                <button
                  onClick={handleSendMessage}
                  disabled={
                    loading ||
                    isUploadingDocs ||
                    isProcessingDocs ||
                    (!input.trim() && pendingImages.length === 0) ||
                    recordingState === "processing"
                  }
                  className="send-icon-btn"
                  title="Send message"
                >
                  {loading ? (
                    <Spinner
                      size={18}
                      weight="bold"
                      className="animate-spin"
                    />
                  ) : (
                    <PaperPlaneRight size={18} weight="bold" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default React.memo(ChatInput);
