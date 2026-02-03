import React, { useState, useEffect, useRef, useCallback } from "react";
import { ListGroup } from "react-bootstrap";
import api, { streamChat } from "../../utils/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import ChatSidebar from "./ChatSidebar";
import ChatMessageItem from "./ChatMessageItem";
import type { Message } from "../../types/chat";
import type { WebSearchOptions } from "../../types/search";
import "../../styles/ChatVariables.css";
import "../../styles/ChatBase.css";
import "../../styles/ChatSidebar.css";
import "../../styles/ChatMessages.css";
import "../../styles/ChatInput.css";
import "../../styles/ChatUtils.css";

interface ChatProps { }

const Chat: React.FC<ChatProps> = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState(() => {
        const saved = localStorage.getItem("selectedModel");
        return saved || "gemini-2.5-flash";
    });
    const [useTools, setUseTools] = useState(() => {
        const saved = localStorage.getItem("useTools");
        return saved === "true";
    });
    const [currentSessionId, setCurrentSessionId] = useState<number | null>(
        null,
    );
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionIdFromUrl = searchParams.get("session");
    const { error: showError } = useToast();

    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(
        null,
    );
    const [streamingResponse, setStreamingResponse] = useState("");
    const [pendingDocumentIds, setPendingDocumentIds] = useState<number[]>([]);
    const [isUploadingDocs, setIsUploadingDocs] = useState(false);
    const [pendingDocuments, setPendingDocuments] = useState<
        { id: number; filename: string; file_type: string }[]
    >([]);

    const streamingResponseRef = useRef("");
    const [streamingAbortController, setStreamingAbortController] =
        useState<AbortController | null>(null);

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
    const [recentSearches, setRecentSearches] = useState<string[]>(() => {
        const saved = localStorage.getItem("recentSearches");
        return saved ? JSON.parse(saved) : [];
    });
    const [searchSuggestions] = useState<string[]>([]);
    const [activeContextMenu, setActiveContextMenu] = useState<{ id: number, type: 'user' | 'assistant' } | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Use a ref to store the latest input for sendMessage to avoid re-creating it on every keystroke
    const inputRef = useRef(input);
    useEffect(() => {
        inputRef.current = input;
    }, [input]);

    const cancelStreaming = useCallback(() => {
        if (streamingAbortController) {
            streamingAbortController.abort();
        }
        setIsStreaming(false);
        setStreamingMessageId(null);
        setStreamingResponse("");
        setStreamingAbortController(null);
        streamingResponseRef.current = "";
    }, [streamingAbortController]);

    const resetStreamingState = useCallback(() => {
        setIsStreaming(false);
        setStreamingMessageId(null);
        setStreamingResponse("");
        setStreamingAbortController(null);
        streamingResponseRef.current = "";
    }, []);

    const handleStreamChunk = useCallback((chunk: string) => {
        streamingResponseRef.current += chunk;
        setStreamingResponse(streamingResponseRef.current);
    }, []);

    const applyToolUpdate = useCallback((messageId: number, toolUpdate: any) => {
        setMessages((prev) =>
            prev.map((msg) => {
                if (msg.id !== messageId) return msg;
                const tools = msg.tool_calls ? [...msg.tool_calls] : [];

                if (toolUpdate.type === 'tool_start') {
                    tools.push({
                        tool: toolUpdate.tool,
                        input: toolUpdate.input,
                        status: 'running',
                    });
                } else if (toolUpdate.type === 'tool_end') {
                    const runningIdx = tools.map(t => t.status).lastIndexOf('running');
                    if (runningIdx !== -1) {
                        tools[runningIdx] = {
                            ...tools[runningIdx],
                            output: toolUpdate.output,
                            status: 'completed',
                        };
                    }
                }

                return {
                    ...msg,
                    tool_calls: tools,
                };
            }),
        );
    }, []);

    const loadModels = useCallback(async () => {
        try {
            // Fetch both models and active API keys to filter the list
            const [modelsRes, keysRes] = await Promise.all([
                api.get("/chat/models"),
                api.get("/users/me/api-keys")
            ]);
            
            const availableModels = modelsRes.data.models;
            const activeProviders = keysRes.data.map((k: any) => k.model_name.toLowerCase());
            
            // Filter models: only show if the provider has an API key
            const filteredModels = availableModels.filter((model: string) => {
                const lowerModel = model.toLowerCase();
                // Google/Gemini
                if (lowerModel.includes('gemini') || lowerModel.includes('google')) {
                    return activeProviders.includes('google');
                }
                // Cerebras (Qwen models on Cerebras)
                if (lowerModel.includes('qwen') || lowerModel.includes('cerebras')) {
                    return activeProviders.includes('cerebras');
                }
                // Groq (Kimi and other models on Groq)
                if (lowerModel.includes('groq') || lowerModel.includes('llama') || lowerModel.includes('mixtral') || lowerModel.includes('kimi')) {
                    return activeProviders.includes('groq');
                }
                return true; // Default to showing other models if any
            });

            setModels(filteredModels);
            if (filteredModels.length > 0 && !filteredModels.includes(selectedModel)) {
                setSelectedModel(filteredModels[0]);
            }
        } catch (error) {
            showError("Loading Error", "Failed to load AI models.");
            console.error("Failed to load models", error);
        }
    }, [selectedModel, showError]);

    const createSession = useCallback(async (title: string = "New Chat") => {
        try {
            const response = await api.post("/sessions", {
                title,
                description: "",
            });
            setCurrentSessionId(response.data.id);
            setMessages([]);
            navigate(`/chat?session=${response.data.id}`, { replace: true });
            return response.data.id;
        } catch (error) {
            showError("Session Error", "Failed to create session.");
            console.error("Failed to create session", error);
            throw error;
        }
    }, [navigate, showError]);

    const copyToClipboard = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.error("Failed to copy text: ", err);
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
        }
    }, []);

    const sendMessage = useCallback(async (images?: string[], overrideContent?: string) => {
        const messageContent = overrideContent ?? inputRef.current;
        if (!messageContent.trim() && (!images || images.length === 0)) return;
        if (isStreaming) return;

        setLoading(true);

        // Add to recent searches if web search is enabled
        if (searchOptions.search_web && messageContent.trim()) {
            setRecentSearches(prev => {
                const filtered = prev.filter(q => q !== messageContent.trim());
                return [messageContent.trim(), ...filtered].slice(0, 10);
            });
        }

        try {
            let sessionId = currentSessionId;

            if (!sessionId) {
                sessionId = await createSession();
                if (!sessionId) {
                    throw new Error("Failed to create session");
                }
            }

            if (!overrideContent) {
                setInput("");
            }

            const currentDocIds = [...pendingDocumentIds];
            setPendingDocumentIds([]);
            const currentDocuments = [...pendingDocuments];
            setPendingDocuments([]);

            const tempMessage: Message = {
                id: Date.now(),
                content: messageContent,
                response: "",
                created_at: new Date().toISOString(),
                status: "sending",
                images: images,
                documents: currentDocuments,
            };
            setMessages((prev) => [...prev, tempMessage]);

            setIsStreaming(true);
            setStreamingMessageId(tempMessage.id);
            setStreamingResponse("");
            streamingResponseRef.current = "";

            const controller = new AbortController();
            setStreamingAbortController(controller);


            await streamChat(
                messageContent,
                selectedModel,
                sessionId,
                { ...searchOptions, document_ids: currentDocIds } as any,
                useTools,
                images,
                handleStreamChunk,
                () => {
                    const finalResponse = streamingResponseRef.current;
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === tempMessage.id
                                ? {
                                    ...msg,
                                    response: finalResponse,
                                    status: "sent" as const,
                                }
                                : msg,
                        ),
                    );
                    resetStreamingState();
                    setInput("");
                },
                (error) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === tempMessage.id
                                ? { ...msg, status: "failed" as const }
                                : msg,
                        ),
                    );
                    showError(
                        "Message Error",
                        `Failed to send message: ${error}`,
                    );
                    resetStreamingState();
                },
                (toolUpdate) => applyToolUpdate(tempMessage.id, toolUpdate),
                controller.signal
            );
        } catch (error) {
            setMessages((prev) =>
                prev.map((msg, index) =>
                    index === prev.length - 1 && msg.status === "sending"
                        ? { ...msg, status: "failed" as const }
                        : msg,
                ),
            );
            showError(
                "Message Error",
                "Failed to send message. Please try again.",
            );
            console.error("Failed to send message", error);
        } finally {
            setLoading(false);
        }
    }, [
        isStreaming,
        searchOptions,
        currentSessionId,
        selectedModel,
        useTools,
        showError,
        createSession,
        handleStreamChunk,
        resetStreamingState,
        applyToolUpdate,
    ]);

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

    const handleCopyMessage = useCallback((message: Message) => {
        const textToCopy = message.response || message.content;
        copyToClipboard(textToCopy);
        setActiveContextMenu(null);
    }, []);

    const handleRegenerateResponse = useCallback(async (message: Message) => {
        if (isStreaming) return;
        setActiveContextMenu(null);

        setLoading(true);

        try {
            let sessionId = currentSessionId;
            if (!sessionId) {
                sessionId = await createSession();
                if (!sessionId) {
                    throw new Error("Failed to create session");
                }
            }

            const docIds = message.documents?.map(doc => doc.id) || [];
            const images = message.images || [];

            setMessages((prev) =>
                prev.map((msg) => {
                    if (msg.id !== message.id) return msg;
                    const versions = msg.response_versions?.length
                        ? [...msg.response_versions]
                        : (msg.response
                            ? [{
                                id: msg.id,
                                response: msg.response,
                                created_at: msg.created_at,
                                model: msg.model,
                            }]
                            : []);

                    return {
                        ...msg,
                        response_versions: versions,
                        response: "",
                        status: "sending" as const,
                        tool_calls: [],
                    };
                }),
            );

            setIsStreaming(true);
            setStreamingMessageId(message.id);
            setStreamingResponse("");
            streamingResponseRef.current = "";

            const controller = new AbortController();
            setStreamingAbortController(controller);

            await streamChat(
                message.content,
                message.model ?? selectedModel,
                sessionId,
                { ...searchOptions, document_ids: docIds } as any,
                useTools,
                images,
                handleStreamChunk,
                () => {
                    const finalResponse = streamingResponseRef.current;
                    setMessages((prev) =>
                        prev.map((msg) => {
                            if (msg.id !== message.id) return msg;
                            const versions = msg.response_versions ? [...msg.response_versions] : [];
                            if (!versions.length || versions[versions.length - 1].response !== finalResponse) {
                                versions.push({
                                    id: msg.id,
                                    response: finalResponse,
                                    created_at: new Date().toISOString(),
                                    model: selectedModel,
                                });
                            }
                            return {
                                ...msg,
                                response: finalResponse,
                                response_versions: versions,
                                status: "sent" as const,
                            };
                        }),
                    );
                    resetStreamingState();
                },
                (error) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === message.id
                                ? { ...msg, status: "failed" as const }
                                : msg,
                        ),
                    );
                    showError(
                        "Message Error",
                        `Failed to regenerate response: ${error}`,
                    );
                    resetStreamingState();
                },
                (toolUpdate) => applyToolUpdate(message.id, toolUpdate),
                controller.signal
            );
        } catch (error) {
            showError(
                "Message Error",
                "Failed to regenerate response. Please try again.",
            );
            console.error("Failed to regenerate response", error);
        } finally {
            setLoading(false);
        }
    }, [
        isStreaming,
        currentSessionId,
        createSession,
        selectedModel,
        searchOptions,
        useTools,
        showError,
        handleStreamChunk,
        resetStreamingState,
        applyToolUpdate,
    ]);

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

    useEffect(() => {
        const handleClickOutside = () => {
            setActiveContextMenu(null);
        };

        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    useEffect(() => {
        const init = async () => {
            await loadModels();
        };
        init();
    }, []);

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
                        // Clear the invalid session parameter - don't auto-create session
                        navigate("/chat", { replace: true });
                    }
                }
            }
        };
        const timer = setTimeout(handleSessionFromUrl, 100);
        return () => clearTimeout(timer);
    }, [sessionIdFromUrl, currentSessionId, navigate, showError]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingResponse]);

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

    const loadHistory = async (sessionId: number) => {
        try {
            const response = await api.get(
                `/chat/history?session_id=${sessionId}&newest_first=false`,
            );
            setMessages(buildVersionedMessages(response.data.data));
        } catch (error) {
            showError("Loading Error", "Failed to load chat history.");
            console.error("Failed to load history", error);
        }
    };

    const loadSessionById = async (sessionId: number) => {
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
    };

    useEffect(() => {
        localStorage.setItem("selectedModel", selectedModel);
    }, [selectedModel]);

    useEffect(() => {
        localStorage.setItem("useTools", useTools.toString());
    }, [useTools]);

    useEffect(() => {
        localStorage.setItem("searchOptions", JSON.stringify(searchOptions));
    }, [searchOptions]);

    useEffect(() => {
        localStorage.setItem("recentSearches", JSON.stringify(recentSearches));
    }, [recentSearches]);

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
                                    handleRegenerateResponse={handleRegenerateResponse}
                                    handleEditMessage={handleEditMessage}
                                    handleDeleteMessage={handleDeleteMessage}
                                    cancelStreaming={cancelStreaming}
                                />
                            ))}
                        </ListGroup>
                        {loading && !streamingResponse ? (
                            <TypingIndicator
                                modelName={selectedModel}
                            />
                        ) : null}
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
                        searchSuggestions={searchSuggestions}
                        onSuggestionSelect={handleSuggestionSelect}
                        recentSearches={recentSearches}
                        onRecentSearchSelect={handleRecentSearchSelect}
                        selectedModel={selectedModel}
                        onFileUpload={handleFileUpload}
                    />
                </div>
            </div>
        </div>
    );
};

export default Chat;
