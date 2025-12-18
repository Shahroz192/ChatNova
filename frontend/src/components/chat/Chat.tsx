import React, { useState, useEffect, useRef } from "react";
import {
    Container,
    Row,
    Col,
    Button,
    Card,
    ListGroup,
    Alert,
} from "react-bootstrap";
import {
    User,
    Bot,
    MoreHorizontal,
    Globe,
    Loader,
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
import type { WebSearchOptions, SearchStatus } from "../../types/search";
import "../../styles/ChatVariables.css";
import "../../styles/ChatBase.css";
import "../../styles/ChatSidebar.css";
import "../../styles/ChatMessages.css";
import "../../styles/ChatInput.css";
import "../../styles/ChatUtils.css";
import GenerativeUIRenderer from "./GenerativeUIRenderer";
import type { UIContainer } from "../../types/generative-ui";

interface ChatProps { }

const Chat: React.FC<ChatProps> = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
    const [useTools, setUseTools] = useState(false);
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

    const [searchOptions, setSearchOptions] = useState<WebSearchOptions>({
        search_web: false,
        search_type: 'general',
        max_results: 10,
        include_snippets: true,
        safe_search: true
    });
    const [searchStatus, setSearchStatus] = useState<SearchStatus>({
        isSearching: false
    });
    const [recentSearches] = useState<string[]>([]);
    const [searchSuggestions] = useState<string[]>([]);

    const [activeContextMenu, setActiveContextMenu] = useState<number | null>(
        null,
    );
    const [hoveredMessage, setHoveredMessage] = useState<number | null>(null);
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

        setSearchStatus(prev => ({
            ...prev,
            isSearching: newOptions.search_web,
            searchType: newOptions.search_type
        }));
    };

    const handleSuggestionSelect = (suggestion: string) => {
        setInput(suggestion);
    };

    const handleRecentSearchSelect = (query: string) => {
        setInput(query);
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
    }, [messages]);

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

    const loadModels = async () => {
        try {
            const response = await api.get("/users/me/api-keys");
            const userModels = response.data.map(
                (key: { model_name: string }) => key.model_name
            );
            setModels(userModels);
            if (userModels.length > 0) {
                setSelectedModel(userModels[0]);
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

    const sendMessage = async () => {
        if (!input.trim()) return;

        setLoading(true);

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
            };
            setMessages((prev) => [...prev, tempMessage]);

            setIsStreaming(true);
            setStreamingMessageId(tempMessage.id);
            setStreamingResponse("");
            streamingResponseRef.current = "";

            const controller = new AbortController();
            setStreamingAbortController(controller);

            if (searchOptions.search_web) {
                setSearchStatus(prev => ({
                    ...prev,
                    isSearching: true,
                    currentQuery: messageContent,
                    searchType: searchOptions.search_type
                }));
            }

            streamChat(
                messageContent,
                selectedModel,
                sessionId,
                searchOptions,
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

                    setSearchStatus({
                        isSearching: false
                    });

                    setInput("");
                },
                (error) => {
                    setMessages((prev) =>
                        prev.map((msg, index) =>
                            index === prev.length - 1 &&
                                msg.status === "sending"
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

                    setSearchStatus({
                        isSearching: false
                    });
                },
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

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
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

    const renderSearchStatus = () => {
        if (!searchOptions.search_web) return null;

        return (
            <div className="search-status-indicator mb-3">
                {searchStatus.isSearching ? (
                    <Alert variant="info" className="searching-alert">
                        <div className="d-flex align-items-center gap-2">
                            <Loader size={16} className="animate-spin" />
                            <span>
                                Searching the web...
                            </span>
                        </div>
                    </Alert>
                ) : (
                    <Alert variant="success" className="search-enabled-alert">
                        <div className="d-flex align-items-center gap-2">
                            <Globe size={16} />
                            <span>
                                Web search enabled
                            </span>
                        </div>
                    </Alert>
                )}
            </div>
        );
    };

    return (
        <>
            <div>
                <Container
                    fluid
                    className="vh-100 d-flex flex-column"
                    style={{ background: "var(--bg-chat)" }}
                >
                    <Row className="flex-grow-1">
                        <ChatSidebar
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                            models={models}
                            useTools={useTools}
                            setUseTools={setUseTools}
                            showSearch={false}
                            setShowSearch={() => { }}
                            isDropdownOpen={isDropdownOpen}
                            setIsDropdownOpen={setIsDropdownOpen}
                            setCurrentSessionId={setCurrentSessionId}
                            setMessages={setMessages}
                        />

                        <Col
                            md={9}
                            className="d-flex flex-column"
                            style={{ height: "100vh" }}
                        >
                            {renderSearchStatus()}

                            <div
                                className="flex-grow-1 chat-messages-area"
                                style={{ overflowY: "auto" }}
                            >
                                <div className="p-4">
                                    <ListGroup variant="flush">
                                        {messages.length === 0 && (
                                            <ListGroup.Item className="border-0 message-item">
                                                <div className="d-flex justify-content-center">
                                                    <div className="text-center py-4">
                                                        <h2 className="h3 fw-bold welcome-title mb-2">
                                                            Welcome to
                                                            ChatNova
                                                        </h2>
                                                        {searchOptions.search_web && (
                                                            <p className="text-muted">
                                                                <Globe size={16} className="me-2" />
                                                                Web search is enabled - I can help you find current information!
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </ListGroup.Item>
                                        )}

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

                                            return (
                                                <ListGroup.Item
                                                    key={msg.id}
                                                    className="border-0 message-item"
                                                    onMouseEnter={() =>
                                                        setHoveredMessage(
                                                            msg.id,
                                                        )
                                                    }
                                                    onMouseLeave={() =>
                                                        setHoveredMessage(null)
                                                    }
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
                                                                onContextMenu={(
                                                                    e,
                                                                ) => {
                                                                    e.preventDefault();
                                                                    setActiveContextMenu(
                                                                        msg.id,
                                                                    );
                                                                }}
                                                            >
                                                                <div className="d-flex align-items-center">
                                                                    <User className="me-2" />
                                                                    {msg.content}
                                                                </div>
                                                            </Card>
                                                            {(hoveredMessage === msg.id || activeContextMenu === msg.id) && (
                                                                <div className="message-actions-overlay user">
                                                                    <button
                                                                        className="message-action-btn"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveContextMenu(
                                                                                activeContextMenu === msg.id ? null : msg.id
                                                                            );
                                                                        }}
                                                                        title="More actions"
                                                                    >
                                                                        <MoreHorizontal size={14} />
                                                                    </button>
                                                                </div>
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
                                                            <Card
                                                                body
                                                                className="message-bubble-assistant"
                                                                style={{
                                                                    width: "fit-content",
                                                                    maxWidth: "100%",
                                                                    height: "auto",
                                                                }}
                                                                onClick={() =>
                                                                    handleMessageClick(
                                                                        msg.id,
                                                                    )
                                                                }
                                                                onContextMenu={(
                                                                    e,
                                                                ) => {
                                                                    e.preventDefault();
                                                                    setActiveContextMenu(
                                                                        msg.id,
                                                                    );
                                                                }}
                                                            >
                                                                <div className="d-flex align-items-start">
                                                                    <Bot className="me-2 mt-1" />
                                                                    <div style={{ flex: 1 }}>
                                                                        {msg.id === streamingMessageId && isStreaming ? (
                                                                            <div className="streaming-response">
                                                                                <div style={{ whiteSpace: "pre-wrap" }}>
                                                                                    {streamingResponse}
                                                                                </div>
                                                                                <div className="streaming-cursor">|</div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex-grow-1">
                                                                                {uiData ? (
                                                                                    <div className="generative-ui-container mt-2 mb-2">
                                                                                        <GenerativeUIRenderer data={uiData} />
                                                                                    </div>
                                                                                ) : (
                                                                                    <MarkdownRenderer
                                                                                        content={msg.response || ""}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </Card>

                                                            {(hoveredMessage === msg.id || activeContextMenu === msg.id) && (
                                                                <div className="message-actions-overlay assistant">
                                                                    <button
                                                                        className="message-action-btn"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveContextMenu(
                                                                                activeContextMenu === msg.id ? null : msg.id
                                                                            );
                                                                        }}
                                                                        title="More actions"
                                                                    >
                                                                        <MoreHorizontal size={14} />
                                                                    </button>
                                                                </div>
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
                                                    <MessageContextMenu
                                                        message={msg}
                                                        isActive={
                                                            activeContextMenu ===
                                                            msg.id
                                                        }
                                                        onClose={() =>
                                                            setActiveContextMenu(
                                                                null,
                                                            )
                                                        }
                                                        handleCopyMessage={
                                                            handleCopyMessage
                                                        }
                                                        handleRegenerateResponse={
                                                            handleRegenerateResponse
                                                        }
                                                        handleEditMessage={
                                                            handleEditMessage
                                                        }
                                                        handleDeleteMessage={
                                                            handleDeleteMessage
                                                        }
                                                    />
                                                </ListGroup.Item>
                                            );
                                        })}
                                    </ListGroup>
                                    {loading && (
                                        <TypingIndicator
                                            modelName={selectedModel}
                                        />
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>
                            <div className="input-area-fixed">
                                <ChatInput
                                    input={input}
                                    setInput={setInput}
                                    handleKeyPress={handleKeyPress}
                                    sendMessage={sendMessage}
                                    loading={loading}
                                    searchOptions={searchOptions}
                                    onSearchOptionsChange={handleSearchOptionsChange}
                                    searchSuggestions={searchSuggestions}
                                    onSuggestionSelect={handleSuggestionSelect}
                                    recentSearches={recentSearches}
                                    onRecentSearchSelect={handleRecentSearchSelect}
                                />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </div>
        </>
    );
};

export default Chat;
