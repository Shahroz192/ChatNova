import React, { useState, useEffect, useRef } from "react";
import {
    Button,
    Card,
    ListGroup,
} from "react-bootstrap";
import {
    User,
} from "lucide-react";
import api, { streamChat } from "../../utils/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import TypingIndicator from "./TypingIndicator";
import Timestamp from "./Timestamp";
import MessageStatus from "./MessageStatus";
import MarkdownRenderer from "./MarkdownRenderer";
import ChatInput from "./ChatInput";
import ChatSidebar from "./ChatSidebar";
import MessageContextMenu from "./MessageContextMenu";
import type { Message } from "../../types/chat";
import type { WebSearchOptions } from "../../types/search";
import "../../styles/ChatVariables.css";
import "../../styles/ChatBase.css";
import "../../styles/ChatSidebar.css";
import "../../styles/ChatMessages.css";
import "../../styles/ChatInput.css";
import "../../styles/ChatUtils.css";
import GenerativeUIRenderer from "./GenerativeUIRenderer";
import SourceList from "./SourceList";
import type { UIContainer } from "../../types/generative-ui";

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
    const [selectedMessageId, setSelectedMessageId] = useState<number | null>(
        null,
    );
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

    const streamingResponseRef = useRef("");
    const [streamingAbortController, setStreamingAbortController] =
        useState<AbortController | null>(null);

    const cancelStreaming = () => {
        if (streamingAbortController) {
            streamingAbortController.abort();
        }
        setIsStreaming(false);
        setStreamingMessageId(null);
        setStreamingResponse("");
        setStreamingAbortController(null);
        streamingResponseRef.current = "";
    };

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

    useEffect(() => {
        // Initial data loading
    }, []);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isDropdownOpen &&
                !(event.target as Element).closest(".custom-dropdown")
            ) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [isDropdownOpen]);


    const handleSearchOptionsChange = (newOptions: WebSearchOptions) => {
        setSearchOptions(newOptions);
    };

    const handleSuggestionSelect = (suggestion: string) => {
        setInput(suggestion);
    };

    const handleRecentSearchSelect = (query: string) => {
        setInput(query);
        setRecentSearches(prev => {
            const filtered = prev.filter(q => q !== query);
            return [query, ...filtered].slice(0, 10); 
        });
    };

    const handleCopyMessage = (message: Message) => {
        const textToCopy = message.response || message.content;
        copyToClipboard(textToCopy);
        setActiveContextMenu(null);
    };

    const handleRegenerateResponse = (message: Message) => {
        setInput(message.content);
        setSelectedMessageId(null);
        setActiveContextMenu(null);
        sendMessage();
    };

    const handleEditMessage = (message: Message) => {
        setInput(message.content);
        setSelectedMessageId(null);
        setActiveContextMenu(null);
    };


    const handleDeleteMessage = async (messageId: number) => {
        try {
            await api.delete(`/chat/history/${messageId}`);
            setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
            setActiveContextMenu(null);
        } catch (error) {
            showError("Delete Error", "Failed to delete message");
        }
    };

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

    const loadHistory = async (sessionId: number) => {
        try {
            const response = await api.get(
                `/chat/history?session_id=${sessionId}&newest_first=false`,
            );
            setMessages(response.data.data);
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

    const loadModels = async () => {
        try {
            const response = await api.get("/chat/models");
            const availableModels = response.data.models;
            setModels(availableModels);
            if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
                setSelectedModel(availableModels[0]);
            }
        } catch (error) {
            showError("Loading Error", "Failed to load AI models.");
            console.error("Failed to load models", error);
        }
    };

    const createSession = async (title: string = "New Chat") => {
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
    };

    const sendMessage = async (images?: string[]) => {
        if (!input.trim() && (!images || images.length === 0)) return;
        if (isStreaming) return;

        setLoading(true);

        // Add to recent searches if web search is enabled
        if (searchOptions.search_web && input.trim()) {
            setRecentSearches(prev => {
                const filtered = prev.filter(q => q !== input.trim());
                return [input.trim(), ...filtered].slice(0, 10);
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

            const messageContent = input;
            setInput("");

            const tempMessage: Message = {
                id: Date.now(),
                content: messageContent,
                response: "",
                created_at: new Date().toISOString(),
                status: "sending",
                // We could also show the attached images in the message bubble if we want
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
                searchOptions,
                useTools,
                images,
                (chunk) => {
                    streamingResponseRef.current += chunk;
                    setStreamingResponse(streamingResponseRef.current);
                },
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
                    setIsStreaming(false);
                    setStreamingMessageId(null);
                    setStreamingAbortController(null);
                    setStreamingResponse("");
                    streamingResponseRef.current = "";


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
                    setIsStreaming(false);
                    setStreamingMessageId(null);
                    setStreamingAbortController(null);
                    setStreamingResponse("");
                    streamingResponseRef.current = "";

                },
                (toolUpdate) => {
                    setMessages((prev) =>
                        prev.map((msg) => {
                            if (msg.id === tempMessage.id) {
                                const tools = msg.tool_calls ? [...msg.tool_calls] : [];
                                
                                if (toolUpdate.type === 'tool_start') {
                                    // Add new tool call
                                    tools.push({
                                        tool: toolUpdate.tool,
                                        input: toolUpdate.input,
                                        status: 'running'
                                    });
                                } else if (toolUpdate.type === 'tool_end') {
                                    // Mark last running tool as completed
                                    // A naive approach assuming sequential execution
                                    const runningIdx = tools.map(t => t.status).lastIndexOf('running');
                                    if (runningIdx !== -1) {
                                        tools[runningIdx] = {
                                            ...tools[runningIdx],
                                            output: toolUpdate.output,
                                            status: 'completed'
                                        };
                                    }
                                }
                                
                                return {
                                    ...msg,
                                    tool_calls: tools
                                };
                            }
                            return msg;
                        })
                    );
                }
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
    };


    const handleMessageClick = (messageId: number) => {
        setSelectedMessageId(
            selectedMessageId === messageId ? null : messageId,
        );
    };

    const copyToClipboard = async (text: string) => {
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
    };


    const handleFileUpload = async (file: File) => {
        try {
            let sessionId = currentSessionId;
            if (!sessionId) {
                sessionId = await createSession();
            }
            
            if (sessionId) {
                const { uploadFile } = await import("../../utils/api");
                await uploadFile(file, sessionId);
            }
        } catch (error) {
            console.error("Upload Error", error);
            showError("Upload Error", "Failed to upload file");
        }
    };


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
                {messages.length === 0 && (
                    <div className="welcome-overlay">
                        <h2 className="h3 fw-bold welcome-title">
                            Chat Smarter,
                            Innovate Faster
                        </h2>
                    </div>
                )}
                <div className="chat-messages-area">
                    <div className="p-4">
                        <ListGroup variant="flush">
                            {messages.map((msg) => {

                                let uiData: UIContainer | null = null;
                                if (msg.response) {
                                    try {
                                        let jsonString = msg.response.trim();

                                        const jsonBlockMatch = jsonString.match(/```json\n([\s\S]*?)\n```/);
                                        if (jsonBlockMatch) {
                                            jsonString = jsonBlockMatch[1];
                                        } else {
                                            const firstOpenBrace = jsonString.indexOf('{');
                                            const lastCloseBrace = jsonString.lastIndexOf('}');
                                            if (firstOpenBrace !== -1 && lastCloseBrace !== -1 && lastCloseBrace > firstOpenBrace) {
                                                jsonString = jsonString.substring(firstOpenBrace, lastCloseBrace + 1);
                                            }
                                        }

                                        const parsed = JSON.parse(jsonString);
                                        if (parsed.type === 'container' && Array.isArray(parsed.children)) {
                                            uiData = parsed;
                                        }
                                    } catch (e) {
                                    }
                                }

                                const responseText = msg.id === streamingMessageId && isStreaming ? streamingResponse : (msg.response || "");
                                const sourcesMatch = responseText.match(/\n\nSources:\n([\s\S]*)$/);
                                const displayResponse = sourcesMatch ? responseText.substring(0, sourcesMatch.index) : responseText;
                                const sources = sourcesMatch ? sourcesMatch[1].trim().split('\n').map(line => {
                                    const m = line.match(/^\[(\d+)\] (.*)$/);
                                    return m ? { id: parseInt(m[1]), filename: m[2] } : null;
                                }).filter((s): s is { id: number; filename: string } => s !== null) : [];

                                return (
                                    <ListGroup.Item
                                        key={msg.id}
                                        className="border-0 message-item"
                                    >
                                        <div className="d-flex justify-content-end mb-2">
                                            <div className="d-flex flex-column align-items-end position-relative">
                                                <Card
                                                    body
                                                    className="message-bubble-user"
                                                    style={{
                                                        width: "fit-content",
                                                        maxWidth:
                                                            "95%",
                                                    }}
                                                    onClick={() =>
                                                        handleMessageClick(
                                                            msg.id,
                                                        )
                                                    }
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        setActiveContextMenu({ id: msg.id, type: 'user' });
                                                    }}
                                                    onDoubleClick={(e) => {
                                                        e.preventDefault();
                                                        setActiveContextMenu({ id: msg.id, type: 'user' });
                                                    }}
                                                >
                                                    <div className="d-flex align-items-center">
                                                        <User className="me-2" />
                                                        {msg.content}
                                                    </div>
                                                </Card>
                                                {activeContextMenu?.id === msg.id && activeContextMenu?.type === 'user' && (
                                                    <MessageContextMenu
                                                        message={msg}
                                                        isActive={true}
                                                        onClose={() => setActiveContextMenu(null)}
                                                        handleCopyMessage={handleCopyMessage}
                                                        handleRegenerateResponse={handleRegenerateResponse}
                                                        handleEditMessage={handleEditMessage}
                                                        handleDeleteMessage={handleDeleteMessage}
                                                        messageType="user"
                                                    />
                                                )}
                                                <div className="d-flex align-items-center mt-1 me-2 gap-2">
                                                    <Timestamp
                                                        dateString={
                                                            msg.created_at
                                                        }
                                                    />
                                                    <MessageStatus
                                                        status={
                                                            msg.status ||
                                                            "sent"
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="d-flex justify-content-start">
                                            <div
                                                className="d-flex flex-column align-items-start position-relative"
                                                style={{
                                                    maxWidth:
                                                        "100%",
                                                }}
                                            >
                                                <div
                                                    className="message-content-assistant"
                                                    onClick={() =>
                                                        handleMessageClick(
                                                            msg.id,
                                                        )
                                                    }
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        setActiveContextMenu({ id: msg.id, type: 'assistant' });
                                                    }}
                                                    onDoubleClick={(e) => {
                                                        e.preventDefault();
                                                        setActiveContextMenu({ id: msg.id, type: 'assistant' });
                                                    }}
                                                >
                                                    <div className="d-flex w-100">
                                                        <div style={{ flex: 1 }}>
                                                            {msg.tool_calls && msg.tool_calls.length > 0 && (
                                                                <div className="tool-calls mb-3">
                                                                    {msg.tool_calls.map((tool, idx) => (
                                                                        <div key={idx} className="tool-call-item text-muted small mb-1">
                                                                            <span className="fw-bold">🛠️ {tool.tool}</span>
                                                                            {tool.status === 'running' && <span className="ms-2 spinner-border spinner-border-sm" role="status" />}
                                                                            {tool.status === 'completed' && <span className="ms-2 text-success">✓</span>}
                                                                            <div className="tool-input ps-3 text-truncate" style={{maxWidth: '300px', opacity: 0.8}}>Input: {tool.input}</div>
                                                                            {tool.output && <div className="tool-output ps-3 text-truncate" style={{maxWidth: '300px', opacity: 0.8}}>Output: {tool.output}</div>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            
                                                            {msg.id === streamingMessageId && isStreaming ? (
                                                                <div className="streaming-response">
                                                                    <MarkdownRenderer content={displayResponse + " ▋"} />
                                                                </div>
                                                            ) : (
                                                                <div className="flex-grow-1 w-100">
                                                                    {uiData ? (
                                                                        <div className="generative-ui-container mt-2 mb-2 w-100">
                                                                            <GenerativeUIRenderer data={uiData} />
                                                                        </div>
                                                                    ) : (
                                                                        <MarkdownRenderer
                                                                            content={displayResponse}
                                                                        />
                                                                    )}
                                                                </div>
                                                            )}
                                                            <SourceList sources={sources} />
                                                        </div>
                                                    </div>
                                                </div>
                                                {activeContextMenu?.id === msg.id && activeContextMenu?.type === 'assistant' && (
                                                    <MessageContextMenu
                                                        message={msg}
                                                        isActive={true}
                                                        onClose={() => setActiveContextMenu(null)}
                                                        handleCopyMessage={handleCopyMessage}
                                                        handleRegenerateResponse={handleRegenerateResponse}
                                                        handleEditMessage={handleEditMessage}
                                                        handleDeleteMessage={handleDeleteMessage}
                                                        messageType="assistant"
                                                    />
                                                )}
                                                <div className="d-flex align-items-center justify-content-between mt-1 ms-2">
                                                    <Timestamp
                                                        dateString={
                                                            msg.created_at
                                                        }
                                                        className="me-2"
                                                    />
                                                    {msg.id ===
                                                        streamingMessageId &&
                                                        isStreaming && (
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                onClick={
                                                                    cancelStreaming
                                                                }
                                                                className="cancel-streaming-btn"
                                                                title="Cancel streaming"
                                                            >
                                                                ✕
                                                            </Button>
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    </ListGroup.Item>
                                );
                            })}
                        </ListGroup>
                        {loading && !streamingResponse && (
                            <TypingIndicator
                                modelName={selectedModel}
                            />
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
                <div className="chat-input-area">
                    <ChatInput
                        input={input}
                        setInput={setInput}
                        sendMessage={sendMessage}
                        loading={loading}
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
