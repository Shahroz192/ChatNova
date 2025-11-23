import React, { useState, useEffect, useRef } from "react";
import {
    Container,
    Row,
    Col,
    Form,
    Button,
    Card,
    ListGroup,
} from "react-bootstrap";
import {
    User,
    Bot,
    Copy,
    RotateCcw,
    Edit,
    Bookmark,
    BookmarkCheck,
    MoreHorizontal,
} from "lucide-react";
import api, { streamChat } from "../../utils/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import TypingIndicator from "./TypingIndicator";
import Timestamp from "./Timestamp";
import MessageStatus from "./MessageStatus";
import MarkdownRenderer from "./MarkdownRenderer";
import ChatInput from "./ChatInput";
import ChatSidebar from "./ChatSidebar";
import MessageContextMenu from "./MessageContextMenu";
import type { Message } from "../../types/chat";
import "../../styles/ChatVariables.css";
import "../../styles/ChatBase.css";
import "../../styles/ChatSidebar.css";
import "../../styles/ChatMessages.css";
import "../../styles/ChatInput.css";
import "../../styles/ChatUtils.css";

interface ChatProps {}

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
    const { darkMode, setDarkMode } = useTheme();

    // Streaming state
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState<number | null>(
        null,
    );
    const [streamingResponse, setStreamingResponse] = useState("");

    const streamingResponseRef = useRef("");
    const [streamingAbortController, setStreamingAbortController] =
        useState<AbortController | null>(null);

    // Cancel streaming function
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

    // Search functionality
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Message[]>([]);
    const [showSearch, setShowSearch] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Message actions state
    const [activeContextMenu, setActiveContextMenu] = useState<number | null>(
        null,
    );
    const [hoveredMessage, setHoveredMessage] = useState<number | null>(null);
    const [bookmarkedMessages, setBookmarkedMessages] = useState<number[]>([]);

    // Dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Load bookmarked messages from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("bookmarkedMessages");
        if (saved) {
            setBookmarkedMessages(JSON.parse(saved));
        }
    }, []);

    // Close dropdown on outside click
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

    // Save bookmarked messages to localStorage
    useEffect(() => {
        localStorage.setItem(
            "bookmarkedMessages",
            JSON.stringify(bookmarkedMessages),
        );
    }, [bookmarkedMessages]);

    // Action handlers
    const handleCopyMessage = (message: Message) => {
        copyToClipboard(message.content + "\n\n" + message.response);
        setActiveContextMenu(null);
    };

    const handleCopyAsCode = (message: Message) => {
        const codeContent = message.response;
        copyToClipboard("```\n" + codeContent + "\n```");
        setActiveContextMenu(null);
    };

    const handleRegenerateResponse = (message: Message) => {
        // Regenerate the AI response by re-sending the user message
        setInput(message.content);
        setSelectedMessageId(null);
        setActiveContextMenu(null);
        sendMessage();
    };

    const handleEditMessage = (message: Message) => {
        // Load the message content into input for editing
        setInput(message.content);
        setSelectedMessageId(null);
        setActiveContextMenu(null);
    };

    const handleBookmarkMessage = (messageId: number) => {
        setBookmarkedMessages((prev) =>
            prev.includes(messageId)
                ? prev.filter((id) => id !== messageId)
                : [...prev, messageId],
        );
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

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setActiveContextMenu(null);
        };

        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    // Context Menu Component

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
        // Small delay to prevent immediate errors on navigation
        const timer = setTimeout(handleSessionFromUrl, 100);
        return () => clearTimeout(timer);
    }, [sessionIdFromUrl, currentSessionId, navigate, showError]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Load recent searches from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("recentSearches");
        if (saved) {
            setRecentSearches(JSON.parse(saved));
        }
    }, []);

    // Search messages function
    const searchMessages = (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        const queryLower = query.toLowerCase();
        const results = messages.filter(
            (msg) =>
                msg.content.toLowerCase().includes(queryLower) ||
                msg.response.toLowerCase().includes(queryLower),
        );
        setSearchResults(results);

        // Save to recent searches
        if (query.trim() && !recentSearches.includes(query.trim())) {
            const updated = [query.trim(), ...recentSearches.slice(0, 4)];
            setRecentSearches(updated);
            localStorage.setItem("recentSearches", JSON.stringify(updated));
        }
    };

    // Handle search input change
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        searchMessages(value);
    };

    // Clear search
    const clearSearch = () => {
        setSearchQuery("");
        setSearchResults([]);
        setShowSearch(false);
    };

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
            // Validate session exists and user has access
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
            const userModels = response.data.api_keys.map(
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
            // Update URL with new session ID
            navigate(`/chat?session=${response.data.id}`, { replace: true });
            return response.data.id; // Return the session ID directly
        } catch (error) {
            showError("Session Error", "Failed to create session.");
            console.error("Failed to create session", error);
            throw error; // Re-throw to allow caller to handle the error
        }
    };

    const sendMessage = async () => {
        if (!input.trim()) return;

        setLoading(true);

        try {
            let sessionId = currentSessionId;

            // Create session if one doesn't exist (first message)
            if (!sessionId) {
                sessionId = await createSession();
                if (!sessionId) {
                    throw new Error("Failed to create session");
                }
            }

            const messageContent = input;
            setInput("");

            // Add user message with sending status
            const tempMessage: Message = {
                id: Date.now(), // Temporary ID
                content: messageContent,
                response: "",
                created_at: new Date().toISOString(),
                status: "sending",
            };
            setMessages((prev) => [...prev, tempMessage]);

            // Use streaming response
            setIsStreaming(true);
            setStreamingMessageId(tempMessage.id);
            setStreamingResponse("");
            streamingResponseRef.current = "";

            // Create abort controller for canceling
            const controller = new AbortController();
            setStreamingAbortController(controller);

            streamChat(
                messageContent,
                selectedModel,
                sessionId,
                (chunk) => {
                    // Handle incoming chunk
                    streamingResponseRef.current += chunk;
                    setStreamingResponse(streamingResponseRef.current);
                },
                () => {
                    // Handle completion
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
                    setInput(""); // Clear input after successful completion
                },
                (error) => {
                    // Handle error
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
                },
            );
        } catch (error) {
            // Mark the last message as failed
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
            // You could add a toast notification here if desired
        } catch (err) {
            console.error("Failed to copy text: ", err);
            // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
        }
    };

    return (
        <>
            <div className={darkMode ? "dark-mode" : ""}>
                <Container
                    fluid
                    className="vh-100 d-flex flex-column"
                    style={{ background: "var(--bg-chat)" }}
                >
                    <Row className="flex-grow-1">
                        {/* Sidebar */}
                        <ChatSidebar
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                            models={models}
                            useTools={useTools}
                            setUseTools={setUseTools}
                            showSearch={showSearch}
                            setShowSearch={setShowSearch}
                            darkMode={darkMode}
                            setDarkMode={setDarkMode}
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
                            {/* Search Bar */}
                            {showSearch && (
                                <div className="search-container p-3 border-bottom">
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <Form.Control
                                            type="text"
                                            placeholder="Search in conversation..."
                                            value={searchQuery}
                                            onChange={handleSearchChange}
                                            autoFocus
                                            className="flex-grow-1"
                                        />
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={clearSearch}
                                        >
                                            ✕
                                        </Button>
                                    </div>

                                    {/* Search Results */}
                                    {searchQuery && (
                                        <div className="search-results">
                                            {searchResults.length > 0 ? (
                                                <div className="mb-2">
                                                    <small className="text-muted">
                                                        Found{" "}
                                                        {searchResults.length}{" "}
                                                        result
                                                        {searchResults.length !==
                                                        1
                                                            ? "s"
                                                            : ""}
                                                    </small>
                                                </div>
                                            ) : (
                                                <div className="mb-2">
                                                    <small className="text-muted">
                                                        No results found
                                                    </small>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Recent Searches */}
                                    {!searchQuery &&
                                        recentSearches.length > 0 && (
                                            <div className="recent-searches">
                                                <small className="text-muted d-block mb-2">
                                                    Recent searches:
                                                </small>
                                                <div className="d-flex flex-wrap gap-2">
                                                    {recentSearches.map(
                                                        (search, idx) => (
                                                            <Button
                                                                key={idx}
                                                                variant="outline-secondary"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSearchQuery(
                                                                        search,
                                                                    );
                                                                    searchMessages(
                                                                        search,
                                                                    );
                                                                }}
                                                            >
                                                                {search}
                                                            </Button>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            )}

                            <div
                                className="flex-grow-1 chat-messages-area"
                                style={{ overflowY: "auto" }}
                            >
                                <div className="p-4">
                                    <ListGroup variant="flush">
                                        {/* Welcome message - only visible when not searching and no messages */}
                                        {!showSearch &&
                                            messages.length === 0 && (
                                                <ListGroup.Item className="border-0 message-item">
                                                    <div className="d-flex justify-content-center">
                                                        <div className="text-center py-4">
                                                            <h2 className="h3 fw-bold welcome-title mb-2">
                                                                Welcome to
                                                                ChatNova
                                                            </h2>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                            )}

                                        {/* Search Results Header */}
                                        {showSearch && searchQuery && (
                                            <ListGroup.Item className="border-0 message-item">
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <strong>
                                                            Search Results
                                                        </strong>
                                                        <span className="text-muted ms-2">
                                                            (
                                                            {
                                                                searchResults.length
                                                            }{" "}
                                                            found)
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        onClick={clearSearch}
                                                    >
                                                        Show All
                                                    </Button>
                                                </div>
                                            </ListGroup.Item>
                                        )}

                                        {/* User messages - show all or filtered */}
                                        {(showSearch && searchQuery
                                            ? searchResults
                                            : messages
                                        ).map((msg) => {
                                            const isBookmarked =
                                                bookmarkedMessages.includes(
                                                    msg.id,
                                                );

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
                                                        <div className="d-flex flex-column align-items-end">
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
                                                                <div className="d-flex align-items-center justify-content-between">
                                                                    <div className="d-flex align-items-center flex-grow-1">
                                                                        <User className="me-2" />
                                                                        {
                                                                            msg.content
                                                                        }
                                                                    </div>

                                                                    {/* Quick actions toolbar */}
                                                                    {(hoveredMessage ===
                                                                        msg.id ||
                                                                        activeContextMenu ===
                                                                            msg.id) && (
                                                                        <div className="message-actions">
                                                                            <div className="message-actions-toolbar">
                                                                                <button
                                                                                    className="message-action-btn"
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        handleCopyMessage(
                                                                                            msg,
                                                                                        );
                                                                                    }}
                                                                                    title="Copy message"
                                                                                >
                                                                                    <Copy
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                    />
                                                                                </button>

                                                                                <button
                                                                                    className="message-action-btn edit"
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        handleEditMessage(
                                                                                            msg,
                                                                                        );
                                                                                    }}
                                                                                    title="Edit message"
                                                                                >
                                                                                    <Edit
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                    />
                                                                                </button>

                                                                                <button
                                                                                    className="message-action-btn"
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        setActiveContextMenu(
                                                                                            activeContextMenu ===
                                                                                                msg.id
                                                                                                ? null
                                                                                                : msg.id,
                                                                                        );
                                                                                    }}
                                                                                    title="More actions"
                                                                                >
                                                                                    <MoreHorizontal
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                    />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </Card>
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
                                                            className="d-flex flex-column align-items-start"
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
                                                                    maxWidth:
                                                                        "100%",
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
                                                                <div className="d-flex align-items-start justify-content-between">
                                                                    <div className="d-flex align-items-start flex-grow-1">
                                                                        <Bot className="me-2 mt-1" />
                                                                        <div
                                                                            style={{
                                                                                flex: 1,
                                                                            }}
                                                                        >
                                                                            {/* Show streaming response if this message is being streamed */}
                                                                            {msg.id ===
                                                                                streamingMessageId &&
                                                                            isStreaming ? (
                                                                                <div className="streaming-response">
                                                                                    <div
                                                                                        style={{
                                                                                            whiteSpace:
                                                                                                "pre-wrap",
                                                                                        }}
                                                                                    >
                                                                                        {
                                                                                            streamingResponse
                                                                                        }
                                                                                    </div>
                                                                                    <div className="streaming-cursor">
                                                                                        |
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <MarkdownRenderer
                                                                                    content={
                                                                                        msg.response
                                                                                    }
                                                                                    darkMode={
                                                                                        darkMode
                                                                                    }
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Quick actions toolbar */}
                                                                    {(hoveredMessage ===
                                                                        msg.id ||
                                                                        activeContextMenu ===
                                                                            msg.id) && (
                                                                        <div className="message-actions">
                                                                            <div className="message-actions-toolbar">
                                                                                <button
                                                                                    className="message-action-btn"
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        handleCopyMessage(
                                                                                            msg,
                                                                                        );
                                                                                    }}
                                                                                    title="Copy message"
                                                                                >
                                                                                    <Copy
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                    />
                                                                                </button>

                                                                                <button
                                                                                    className="message-action-btn copy-code"
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        handleCopyAsCode(
                                                                                            msg,
                                                                                        );
                                                                                    }}
                                                                                    title="Copy as code"
                                                                                >
                                                                                    <Copy
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                    />
                                                                                </button>

                                                                                <button
                                                                                    className="message-action-btn regenerate"
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        handleRegenerateResponse(
                                                                                            msg,
                                                                                        );
                                                                                    }}
                                                                                    title="Regenerate response"
                                                                                >
                                                                                    <RotateCcw
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                    />
                                                                                </button>

                                                                                <button
                                                                                    className="message-action-btn"
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        handleBookmarkMessage(
                                                                                            msg.id,
                                                                                        );
                                                                                    }}
                                                                                    title={
                                                                                        isBookmarked
                                                                                            ? "Remove bookmark"
                                                                                            : "Bookmark"
                                                                                    }
                                                                                >
                                                                                    {isBookmarked ? (
                                                                                        <BookmarkCheck
                                                                                            size={
                                                                                                14
                                                                                            }
                                                                                        />
                                                                                    ) : (
                                                                                        <Bookmark
                                                                                            size={
                                                                                                14
                                                                                            }
                                                                                        />
                                                                                    )}
                                                                                </button>

                                                                                <button
                                                                                    className="message-action-btn"
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        setActiveContextMenu(
                                                                                            activeContextMenu ===
                                                                                                msg.id
                                                                                                ? null
                                                                                                : msg.id,
                                                                                        );
                                                                                    }}
                                                                                    title="More actions"
                                                                                >
                                                                                    <MoreHorizontal
                                                                                        size={
                                                                                            14
                                                                                        }
                                                                                    />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </Card>
                                                            <div className="d-flex align-items-center justify-content-between mt-1 ms-2">
                                                                <Timestamp
                                                                    dateString={
                                                                        msg.created_at
                                                                    }
                                                                    className="me-2"
                                                                />
                                                                {/* Show cancel button for streaming messages */}
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
                                                    {/* Context Menu */}
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
                                                        bookmarkedMessages={
                                                            bookmarkedMessages
                                                        }
                                                        handleCopyMessage={
                                                            handleCopyMessage
                                                        }
                                                        handleCopyAsCode={
                                                            handleCopyAsCode
                                                        }
                                                        handleRegenerateResponse={
                                                            handleRegenerateResponse
                                                        }
                                                        handleBookmarkMessage={
                                                            handleBookmarkMessage
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
                                            darkMode={darkMode}
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
