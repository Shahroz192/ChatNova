import React, { useState, useEffect, useRef, useCallback } from "react";
import { ListGroup } from "react-bootstrap";
import api, { getSearchHistory } from "../../utils/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import ChatInput from "./ChatInput";
import ChatSidebar from "./ChatSidebar";
import ChatMessageItem from "./ChatMessageItem";
import type { Message } from "../../types/chat";
import type { WebSearchOptions } from "../../types/search";
import { useChatSessions } from "../../hooks/useChatSessions";
import { useChatModels } from "../../hooks/useChatModels";
import { useChatStreaming } from "../../hooks/useChatStreaming";

import "../../styles/ChatVariables.css";
import "../../styles/ChatBase.css";
import "../../styles/ChatMessages.css";
import "../../styles/ChatInput.css";
import "../../styles/ChatUtils.css";

interface ChatProps { }

const Chat: React.FC<ChatProps> = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [useTools, setUseTools] = useState(() => {
    const saved = localStorage.getItem("useTools");
    return saved === "true";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionIdFromUrl = searchParams.get("session");
  const { error: showError } = useToast();

  const [pendingDocumentIds, setPendingDocumentIds] = useState<number[]>([]);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<
    { id: number; filename: string; file_type: string }[]
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
      search_type: 'general',
      max_results: 10,
      include_snippets: true,
      safe_search: true
    };
  });
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeContextMenu, setActiveContextMenu] = useState<{ id: number, type: 'user' | 'assistant' } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  const {
    models,
    selectedModel,
    setSelectedModel
  } = useChatModels();

  const {
    isStreaming,
    streamingMessageId,
    streamingResponse,
    loading,
    sendMessage: streamSendMessage,
    regenerateResponse,
    cancelStreaming
  } = useChatStreaming(
    setMessages,
    currentSessionId,
    selectedModel,
    searchOptions,
    useTools,
    createSession,
    fetchSessions
  );

  // Fetch search history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await getSearchHistory();
        setRecentSearches(history.map(item => item.query));
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

  const buildVersionedMessages = useCallback((rawMessages: Message[]) => {
    const result: Message[] = [];
    const byKey = new Map<string, Message>();
    const MAX_VERSION_GAP_MS = 2 * 60 * 1000;

    rawMessages.forEach((msg) => {
      const docIds = (msg.documents || []).map(doc => doc.id).sort((a, b) => a - b);
      const imagesKey = msg.images ? JSON.stringify(msg.images) : "";
      const key = `${msg.content}||${imagesKey}||${JSON.stringify(docIds)}||${msg.model || ""}`;

      const lastBase = result.length ? result[result.length - 1] : null;
      const isAdjacentMatch = lastBase
        ? (() => {
          const lastDocIds = (lastBase.documents || []).map(doc => doc.id).sort((a, b) => a - b);
          const lastImagesKey = lastBase.images ? JSON.stringify(lastBase.images) : "";
          const lastKey = `${lastBase.content}||${lastImagesKey}||${JSON.stringify(lastDocIds)}||${lastBase.model || ""}`;
          if (lastKey !== key) return false;
          const lastTime = new Date(lastBase.created_at).getTime();
          const currentTime = new Date(msg.created_at).getTime();
          return Math.abs(currentTime - lastTime) <= MAX_VERSION_GAP_MS;
        })()
        : false;

      if (!byKey.has(key) || !isAdjacentMatch) {
        const base: Message = { ...msg };
        if (base.response) {
          base.response_versions = base.response_versions?.length
            ? base.response_versions
            : [{
              id: base.id,
              response: base.response,
              created_at: base.created_at,
              model: base.model,
            }];
        }
        byKey.set(key, base);
        result.push(base);
      } else {
        const base = byKey.get(key)!;
        const versions = base.response_versions ? [...base.response_versions] : [];
        if (base.response && versions.length === 0) {
          versions.push({
            id: base.id,
            response: base.response,
            created_at: base.created_at,
            model: base.model,
          });
        }
        if (msg.response) {
          versions.push({
            id: msg.id,
            response: msg.response,
            created_at: msg.created_at,
            model: msg.model,
          });
        }
        base.response_versions = versions;
        if (msg.response) {
          base.response = msg.response;
        }
      }
    });

    result.forEach((msg) => {
      if (msg.response_versions && msg.response_versions.length > 1) {
        msg.response_versions.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        msg.response = msg.response_versions[msg.response_versions.length - 1].response;
      }
    });

    return result;
  }, []);

  const loadHistory = useCallback(async (sessionId: number) => {
    try {
      const response = await api.get(
        `/chat/history?session_id=${sessionId}&newest_first=false`,
      );
      setMessages(buildVersionedMessages(response.data.data));
    } catch (error) {
      showError("Loading Error", "Failed to load chat history.");
      console.error("Failed to load history", error);
    }
  }, [buildVersionedMessages, showError]);

  const loadSessionById = useCallback(async (sessionId: number) => {
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
  }, [setCurrentSessionId, loadHistory]);

  const handleSessionSelect = useCallback((sessionId: number) => {
    navigate(`/chat?session=${sessionId}`);
  }, [navigate]);

  const handleDeleteSession = useCallback(async (sessionId: number) => {
    await deleteSession(sessionId, () => setMessages([]));
  }, [deleteSession]);

  useEffect(() => {
    const handleSessionFromUrl = async () => {
      if (sessionIdFromUrl) {
        const sessionId = parseInt(sessionIdFromUrl);
        if (!isNaN(sessionId) && sessionId !== currentSessionId) {
          const success = await loadSessionById(sessionId);
          if (!success) {
            showError(
              "Session Error",
              `Session ${sessionId} not found or access denied.`,
            );
            navigate("/chat", { replace: true });
          }
        }
      }
    };
    const timer = setTimeout(handleSessionFromUrl, 100);
    return () => clearTimeout(timer);
  }, [sessionIdFromUrl, currentSessionId, navigate, showError, loadSessionById]);

  const sendMessage = useCallback(async (images?: string[], overrideContent?: string) => {
    const content = overrideContent ?? input;

    // Add to recent searches if web search is enabled
    if (searchOptions.search_web && content.trim()) {
      setRecentSearches(prev => {
        const filtered = prev.filter(q => q !== content.trim());
        return [content.trim(), ...filtered].slice(0, 10);
      });
    }

    const currentDocIds = [...pendingDocumentIds];
    setPendingDocumentIds([]);
    const currentDocuments = [...pendingDocuments];
    setPendingDocuments([]);

    await streamSendMessage(
      content,
      images,
      currentDocIds,
      currentDocuments,
      () => {
        if (!overrideContent) setInput("");
      }
    );
  }, [input, pendingDocumentIds, pendingDocuments, searchOptions.search_web, streamSendMessage]);

  const handleSearchOptionsChange = useCallback((newOptions: WebSearchOptions) => {
    setSearchOptions(newOptions);
  }, []);

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setInput(suggestion);
  }, []);

  const handleRecentSearchSelect = useCallback((query: string) => {
    setInput(query);
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q !== query);
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

  const handleDeleteMessage = useCallback(async (messageId: number) => {
    try {
      await api.delete(`/chat/history/${messageId}`);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      setActiveContextMenu(null);
    } catch (error) {
      showError("Delete Error", "Failed to delete message");
    }
  }, [showError]);

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setIsUploadingDocs(true);
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = await createSession();
      }

      if (sessionId) {
        const { uploadFile } = await import("../../utils/api");
        const docRecord = await uploadFile(file, sessionId);
        if (docRecord && docRecord.id) {
          setPendingDocumentIds(prev => [...prev, docRecord.id]);
          setPendingDocuments(prev => [
            ...prev,
            {
              id: docRecord.id,
              filename: docRecord.filename,
              file_type: docRecord.file_type,
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Upload Error", error);
      showError("Upload Error", "Failed to upload file");
    } finally {
      setIsUploadingDocs(false);
    }
  }, [currentSessionId, showError, createSession]);

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
      />

      <div className="chat-main-content">
        {messages.length === 0 ? (
          <div className="welcome-overlay">
            <h2 className="h3 fw-bold welcome-title">
              Chat Smarter,
              Innovate Faster
            </h2>
          </div>
        ) : null}
        <div className="chat-messages-area">
          <div className="p-4">
            <ListGroup variant="flush">
              {messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  msg={msg}
                  streamingMessageId={streamingMessageId}
                  isStreaming={isStreaming}
                  streamingResponse={msg.id === streamingMessageId ? streamingResponse : ""}
                  activeContextMenu={activeContextMenu}
                  setActiveContextMenu={setActiveContextMenu}
                  handleCopyMessage={handleCopyMessage}
                  handleRegenerateResponse={regenerateResponse}
                  handleEditMessage={handleEditMessage}
                  handleDeleteMessage={handleDeleteMessage}
                  cancelStreaming={cancelStreaming}
                />
              ))}
            </ListGroup>
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="chat-input-area">
          <ChatInput
            input={input}
            setInput={setInput}
            sendMessage={sendMessage}
            loading={loading}
            isUploadingDocs={isUploadingDocs}
            searchOptions={searchOptions}
            onSearchOptionsChange={handleSearchOptionsChange}
            searchSuggestions={[]}
            onSuggestionSelect={handleSuggestionSelect}
            recentSearches={recentSearches}
            onRecentSearchSelect={handleRecentSearchSelect}
            selectedModel={selectedModel}
            onFileUpload={handleFileUpload}
            models={models}
            useTools={useTools}
            onUseToolsChange={setUseTools}
            onModelSelect={setSelectedModel}
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;
