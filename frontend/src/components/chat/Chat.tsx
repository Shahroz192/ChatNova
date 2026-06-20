import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MagnifyingGlass,
  FileText,
  Code,
  ChartBar,
  Lightbulb,
  BookOpen,
  ArrowRight,
} from "@phosphor-icons/react";

import api, { getSearchHistory, getDocumentStatus } from "../../utils/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import ChatInput from "./ChatInput";
import ChatSidebar from "./ChatSidebar";
import ChatMessageItem from "./ChatMessageItem";
import SettingsModal from "../settings/SettingsModal";
import type { Message } from "../../types/chat";
import type { WebSearchOptions } from "../../types/search";
import { useChatSessions } from "../../hooks/useChatSessions";
import { useChatModels } from "../../hooks/useChatModels";
import { useChatStreaming } from "../../hooks/useChatStreaming";

import "../../styles/ChatBase.css";
import "../../styles/ChatMessages.css";
import "../../styles/ChatInput.css";
import "../../styles/ChatUtils.css";

interface ChatProps {}

interface PendingDocumentAttachment {
  clientId: string;
  id: number | null;
  filename: string;
  file_type: string;
  isUploading: boolean;
  processingStatus: "pending" | "processing" | "completed" | "failed";
}

const Chat: React.FC<ChatProps> = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [useTools, setUseTools] = useState(() => {
    const saved = localStorage.getItem("useTools");
    return saved === "true";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentSessionIdRef = useRef<number | null>(null);
  const sessionCreationRef = useRef<Promise<number> | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionIdFromUrl = searchParams.get("session");
  const { error: showError } = useToast();

  const [pendingDocuments, setPendingDocuments] = useState<
    PendingDocumentAttachment[]
  >([]);

  const [searchOptions, setSearchOptions] = useState<WebSearchOptions>(() => {
    const saved = localStorage.getItem("searchOptions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Return default if parse fails
      }
    }
    return {
      search_web: false,
      search_type: "general",
      max_results: 10,
      include_snippets: true,
      safe_search: true,
    };
  });
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [activeContextMenu, setActiveContextMenu] = useState<{
    id: number;
    type: "user" | "assistant";
  } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const suggestionCards = useMemo(() => [
    {
      icon: MagnifyingGlass,
      title: "Research & Summarize",
      desc: "Research any topic and get a concise summary",
      prompt: "Research and summarize the latest developments in ",
    },
    {
      icon: FileText,
      title: "Write & Create",
      desc: "Draft emails, stories, or creative content",
      prompt: "Help me write ",
    },
    {
      icon: Code,
      title: "Code & Debug",
      desc: "Get help with code, debugging, and architecture",
      prompt: "Help me debug this code: ",
    },
    {
      icon: ChartBar,
      title: "Analyze Data",
      desc: "Analyze data, create charts, and visualize insights",
      prompt: "Analyze this data and show me a visualization: ",
    },
    {
      icon: Lightbulb,
      title: "Brainstorm Ideas",
      desc: "Generate creative ideas and solutions",
      prompt: "Help me brainstorm ideas for ",
    },
    {
      icon: BookOpen,
      title: "Learn & Explain",
      desc: "Get clear explanations of complex topics",
      prompt: "Explain ",
    },
  ], []);

  const handleSuggestionClick = useCallback((prompt: string) => {
    setInput(prompt);
    requestAnimationFrame(() => {
      const textarea = document.querySelector('.modern-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, []);
  const isUploadingDocs = pendingDocuments.some((doc) => doc.isUploading);
  const isProcessingDocs = pendingDocuments.some(
    (doc) => doc.processingStatus === "pending" || doc.processingStatus === "processing",
  );

  // Custom Hooks
  const {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    isLoadingSessions,
    hasMoreSessions,
    fetchSessions,
    handleSearchSessions,
    handleLoadMoreSessions,
    createSession,
    deleteSession,
  } = useChatSessions(sessionIdFromUrl);

  const { models, selectedModel, setSelectedModel } = useChatModels();

  const {
    isStreaming,
    streamingMessageId,
    streamingResponse,
    loading,
    sendMessage: streamSendMessage,
    regenerateResponse,
    cancelStreaming,
  } = useChatStreaming(
    setMessages,
    currentSessionId,
    selectedModel,
    searchOptions,
    useTools,
    createSession,
    fetchSessions,
  );

  // Fetch search history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await getSearchHistory();
        setRecentSearches(history.map((item) => item.query));
      } catch (error) {
        console.error("Failed to fetch search history:", error);
      }
    };
    fetchHistory();
  }, []);

  // Use a ref to store the latest input for sendMessage to avoid re-creating it on every keystroke
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const ensureSessionId = useCallback(async () => {
    if (currentSessionIdRef.current) {
      return currentSessionIdRef.current;
    }

    if (!sessionCreationRef.current) {
      sessionCreationRef.current = createSession().finally(() => {
        sessionCreationRef.current = null;
      });
    }

    const sessionId = await sessionCreationRef.current;
    currentSessionIdRef.current = sessionId;
    return sessionId;
  }, [createSession]);

  const loadHistory = useCallback(
    async (sessionId: number) => {
      try {
        const response = await api.get(
          `/chat/history?session_id=${sessionId}&newest_first=false`,
        );
        setMessages(response.data.data);
      } catch (error) {
        showError("Failed to load history");
        console.error("Failed to load history", error);
      }
    },
    [showError],
  );

  const loadSessionById = useCallback(
    async (sessionId: number) => {
      try {
        const response = await api.get(`/sessions/${sessionId}`);
        if (response.data) {
          setCurrentSessionId(sessionId);
          await loadHistory(sessionId);
          return true;
        }
      } catch (error) {
        console.error("Failed to load session", error);
        return false;
      }
      return false;
    },
    [setCurrentSessionId, loadHistory],
  );

  const handleSessionSelect = useCallback(
    (sessionId: number) => {
      navigate(`/chat?session=${sessionId}`);
    },
    [navigate],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      await deleteSession(sessionId, () => setMessages([]));
    },
    [deleteSession],
  );

  useEffect(() => {
    const handleSessionFromUrl = async () => {
      if (sessionIdFromUrl) {
        const sessionId = parseInt(sessionIdFromUrl);
        if (!isNaN(sessionId) && sessionId !== currentSessionId) {
          const success = await loadSessionById(sessionId);
          if (!success) {
            showError(
              `Session not found`,
            );
            navigate("/chat", { replace: true });
          }
        }
      }
    };
    const timer = setTimeout(handleSessionFromUrl, 100);
    return () => clearTimeout(timer);
  }, [
    sessionIdFromUrl,
    currentSessionId,
    navigate,
    showError,
    loadSessionById,
  ]);

  useEffect(() => {
    if (!activeContextMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".message-context-menu")) {
        return;
      }
      setActiveContextMenu(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [activeContextMenu]);

  const sendMessage = useCallback(
    async (images?: string[], overrideContent?: string) => {
      const content = overrideContent ?? input;

      if (!selectedModel) {
        showError(
          "Model Error",
          "Please wait for models to load or select a model.",
        );
        return;
      }

      // Check if any documents are still processing
      const processingDocs = pendingDocuments.filter(
        (doc) => doc.processingStatus === "pending" || doc.processingStatus === "processing"
      );
      if (processingDocs.length > 0) {
        showError(
          "Documents Processing",
          `Please wait for ${processingDocs.length} document(s) to finish processing before sending your message.`,
        );
        return;
      }

      // Add to recent searches if web search is enabled
      if (searchOptions.search_web && content.trim()) {
        setRecentSearches((prev) => {
          const filtered = prev.filter((q) => q !== content.trim());
          return [content.trim(), ...filtered].slice(0, 10);
        });
      }

      const sessionId = await ensureSessionId();
      const currentDocuments = pendingDocuments
        .filter((doc) => doc.id !== null && !doc.isUploading && doc.processingStatus === "completed")
        .map((doc) => ({
          id: doc.id as number,
          filename: doc.filename,
          file_type: doc.file_type,
        }));
      const currentDocIds = currentDocuments.map((doc) => doc.id);
      setPendingDocuments([]);

      await streamSendMessage(
        content,
        images,
        currentDocIds,
        currentDocuments,
        () => {
          if (!overrideContent) setInput("");
        },
        sessionId,
      );
    },
    [
      ensureSessionId,
      input,
      pendingDocuments,
      selectedModel,
      searchOptions.search_web,
      streamSendMessage,
      showError,
    ],
  );

  const handleSearchOptionsChange = useCallback(
    (newOptions: WebSearchOptions) => {
      setSearchOptions(newOptions);
    },
    [],
  );

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setInput(suggestion);
  }, []);

  const handleRecentSearchSelect = useCallback((query: string) => {
    setInput(query);
    setRecentSearches((prev) => {
      const filtered = prev.filter((q) => q !== query);
      return [query, ...filtered].slice(0, 10);
    });
  }, []);

  const handleCopyMessage = useCallback(async (message: Message) => {
    const textToCopy = message.response || message.content;
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
    setActiveContextMenu(null);
  }, []);

  const handleEditMessage = useCallback((message: Message) => {
    setInput(message.content);
    setActiveContextMenu(null);
  }, []);

  const handleDeleteMessage = useCallback(
    async (messageId: number) => {
      try {
        await api.delete(`/chat/history/${messageId}`);
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        setActiveContextMenu(null);
      } catch (error) {
        showError("Failed to delete message");
      }
    },
    [showError],
  );

  const activePollingRef = useRef<Map<string, boolean>>(new Map());
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      activePollingRef.current.clear();
    };
  }, []);

  const pollDocumentStatus = useCallback(async (documentId: number, clientId: string) => {
    if (activePollingRef.current.has(clientId)) return; // Already polling this doc
    activePollingRef.current.set(clientId, true);

    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts && isMountedRef.current) {
      try {
        const status = await getDocumentStatus(documentId);

        if (!isMountedRef.current) break;

        setPendingDocuments((prev) =>
          prev.map((doc) =>
            doc.clientId === clientId
              ? {
                  ...doc,
                  processingStatus: status.status as "pending" | "processing" | "completed" | "failed",
                }
              : doc,
          ),
        );

        if (status.status === "completed" || status.status === "failed") {
          break;
        }
      } catch (error) {
        if (!isMountedRef.current) break;
        console.error("Error polling document status:", error);
      }

      attempts++;
      if (attempts < maxAttempts && isMountedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    activePollingRef.current.delete(clientId);
  }, []);

  const handleFileUpload = useCallback(
    async (file: File, clientId: string) => {
      setPendingDocuments((prev) => [
        ...prev,
        {
          clientId,
          id: null,
          filename: file.name,
          file_type: file.type || "application/octet-stream",
          isUploading: true,
          processingStatus: "pending",
        },
      ]);

      try {
        const sessionId = await ensureSessionId();

        if (sessionId) {
          const { uploadFile } = await import("../../utils/api");
          const docRecord = await uploadFile(file, sessionId);
          if (docRecord && docRecord.id) {
            setPendingDocuments((prev) =>
              prev.map((doc) =>
                doc.clientId === clientId
                  ? {
                      ...doc,
                      id: docRecord.id,
                      filename: docRecord.filename,
                      file_type: docRecord.file_type,
                      isUploading: false,
                      processingStatus: docRecord.processing_status || "pending",
                    }
                  : doc,
              ),
            );

            // Start polling for document processing status
            pollDocumentStatus(docRecord.id, clientId);
          }
        }
      } catch (error) {
        setPendingDocuments((prev) =>
          prev.filter((doc) => doc.clientId !== clientId),
        );
        console.error("Upload Error", error);
        showError("Failed to upload file");
      }
    },
    [ensureSessionId, showError, pollDocumentStatus],
  );

  const handleFileRemove = useCallback((clientId: string) => {
    activePollingRef.current.delete(clientId); // Cancel active polling for this doc
    setPendingDocuments((prev) =>
      prev.filter((doc) => doc.clientId !== clientId),
    );
  }, []);

  useEffect(() => {
    localStorage.setItem("useTools", useTools.toString());
  }, [useTools]);

  useEffect(() => {
    localStorage.setItem("searchOptions", JSON.stringify(searchOptions));
  }, [searchOptions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingResponse]);

  return (
    <div className="chat-layout">
      <ChatSidebar
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        models={models}
        useTools={useTools}
        setUseTools={setUseTools}
        isDropdownOpen={isDropdownOpen}
        setIsDropdownOpen={setIsDropdownOpen}
        setCurrentSessionId={setCurrentSessionId}
        setMessages={setMessages}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onDeleteSession={handleDeleteSession}
        onSearch={handleSearchSessions}
        onLoadMore={handleLoadMoreSessions}
        hasMore={hasMoreSessions}
        isLoading={isLoadingSessions}
        onToggleExpanded={setIsSidebarExpanded}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className={`chat-main-content ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
        <div className={`welcome-overlay ${messages.length > 0 ? 'hidden' : ''} ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
          <div className="welcome-inner">
            <div className="welcome-cards-grid">
              {suggestionCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <button
                    key={i}
                    className="welcome-card"
                    onClick={() => handleSuggestionClick(card.prompt)}
                  >
                    <div className="welcome-card-icon">
                      <Icon size={22} weight="bold" />
                    </div>
                    <div className="welcome-card-text">
                      <span className="welcome-card-title">{card.title}</span>
                      <span className="welcome-card-desc">{card.desc}</span>
                    </div>
                    <ArrowRight size={14} className="welcome-card-arrow" weight="bold" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="chat-messages-area">
          <div className="p-4">
            <div className="flex flex-col">
              {messages.map((msg, index) => (
                <ChatMessageItem
                  key={msg.id}
                  msg={msg}
                  msgIndex={index}
                  streamingMessageId={streamingMessageId}
                  isStreaming={isStreaming}
                  streamingResponse={
                    msg.id === streamingMessageId ? streamingResponse : ""
                  }
                  activeContextMenu={activeContextMenu}
                  setActiveContextMenu={setActiveContextMenu}
                  handleCopyMessage={handleCopyMessage}
                  handleRegenerateResponse={regenerateResponse}
                  handleEditMessage={handleEditMessage}
                  handleDeleteMessage={handleDeleteMessage}
                  cancelStreaming={cancelStreaming}
                />
              ))}
            </div>
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className={`chat-input-area ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
          <ChatInput
            input={input}
            setInput={setInput}
            sendMessage={sendMessage}
            loading={loading}
            isUploadingDocs={isUploadingDocs}
            isProcessingDocs={isProcessingDocs}
            searchOptions={searchOptions}
            onSearchOptionsChange={handleSearchOptionsChange}
            searchSuggestions={[]}
            onSuggestionSelect={handleSuggestionSelect}
            recentSearches={recentSearches}
            onRecentSearchSelect={handleRecentSearchSelect}
            selectedModel={selectedModel}
            onFileUpload={handleFileUpload}
            pendingDocuments={pendingDocuments.map((doc) => ({
              clientId: doc.clientId,
              name: doc.filename,
              isUploading: doc.isUploading,
              processingStatus: doc.processingStatus,
            }))}
            onFileRemove={handleFileRemove}
            models={models}
            useTools={useTools}
            onUseToolsChange={setUseTools}
            onModelSelect={setSelectedModel}
          />
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default Chat;
