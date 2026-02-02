import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Container,
    Row,
    Col,
    Form,
    Button,
    Alert,
    Modal,
    ListGroup,
    InputGroup,
} from "react-bootstrap";
import { Search, Trash, Download, Pin, PinOff, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import "../../styles/HistoryManagement.css";

interface ChatSession {
    id: number;
    title: string;
    description: string;
    created_at: string;
    message_count: number;
}

interface Message {
    id: number;
    content: string;
    response: string;
    created_at: string;
}

interface HistoryMeta {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
    has_more: boolean;
    skip: number;
    limit: number;
}

const HistoryManagement: React.FC = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [meta, setMeta] = useState<HistoryMeta | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [skip, setSkip] = useState(0);
    const [limit, setLimit] = useState(50);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteBeforeDate, setDeleteBeforeDate] = useState("");
    const [streaming, setStreaming] = useState(false);

    const [searchFilter] = useState<"all" | "sessions">("all");
    const [dateFilter, setDateFilter] = useState("");
    const [pinnedSessions, setPinnedSessions] = useState<Set<number>>(
        new Set(),
    );

    const loadHistory = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({
                skip: skip.toString(),
                limit: limit.toString(),
                newest_first: "true",
            });
            if (search) params.append("search", search);
            const response = await api.get(`/sessions?${params}`);
            setSessions(response.data.data);
            setMeta(response.data.meta);
        } catch (error) {
            setError("Failed to load sessions.");
            console.error("Failed to load sessions", error);
        } finally {
            setLoading(false);
        }
    }, [skip, limit, search]);

    const loadPinnedSessions = useCallback(() => {
        const saved = localStorage.getItem("pinnedSessions");
        if (saved) {
            setPinnedSessions(new Set(JSON.parse(saved)));
        }
    }, []);

    useEffect(() => {
        loadHistory();
        loadPinnedSessions();
    }, [loadHistory, loadPinnedSessions]);

    const togglePinSession = useCallback((sessionId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setPinnedSessions(prev => {
            const newPinned = new Set(prev);
            if (newPinned.has(sessionId)) {
                newPinned.delete(sessionId);
            } else {
                newPinned.add(sessionId);
            }
            localStorage.setItem(
                "pinnedSessions",
                JSON.stringify(Array.from(newPinned)),
            );
            return newPinned;
        });
    }, []);

    // Filter and sort sessions based on search criteria
    const filteredSessions = useMemo(() => sessions
        .filter((session) => {
            // Date filter
            if (dateFilter) {
                const sessionDate = new Date(session.created_at)
                    .toISOString()
                    .split("T")[0];
                if (sessionDate !== dateFilter) return false;
            }

            // Title/description search
            if (search && searchFilter === "sessions") {
                const title = session.title.toLowerCase();
                const desc = session.description.toLowerCase();
                const matches =
                    title.includes(search.toLowerCase()) ||
                    desc.includes(search.toLowerCase());
                if (!matches) return false;
            }

            return true;
        })
        .sort((a, b) => {
            // Sort pinned sessions first
            const aPinned = pinnedSessions.has(a.id);
            const bPinned = pinnedSessions.has(b.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return 0;
        }), [sessions, dateFilter, search, searchFilter, pinnedSessions]);

    const handleSearch = useCallback(() => {
        setSkip(0);
        loadHistory();
    }, [loadHistory]);

    const handleDelete = useCallback(async () => {
        try {
            await api.delete(
                `/sessions${deleteBeforeDate ? `?before_date=${deleteBeforeDate}` : ""}`,
            );
            setShowDeleteModal(false);
            setDeleteBeforeDate("");
            loadHistory();
        } catch (error) {
            setError("Failed to delete sessions.");
            console.error("Failed to delete sessions", error);
        }
    }, [deleteBeforeDate, loadHistory]);

    const handleStream = useCallback(async () => {
        setStreaming(true);
        try {
            const params = new URLSearchParams({
                skip: skip.toString(),
                limit: limit.toString(),
                newest_first: "true",
                compress: "false",
            });
            // Use the configured api instance which handles cookies automatically
            const response = await api.get(`/sessions/stream?${params}`, {
                responseType: "stream",
            });
            // For now, we'll just use the regular API since we're using axios
            // The API service is configured to handle cookies automatically
            console.log("Stream response:", response); // For debugging
        } catch (error) {
            setError("Failed to stream sessions.");
            console.error("Failed to stream sessions", error);
        } finally {
            setStreaming(false);
        }
    }, [skip, limit]);

    const handleSessionClick = useCallback((sessionId: number) => {
        navigate(`/chat?session=${sessionId}`);
    }, [navigate]);

    const handleSessionDelete = useCallback(async (
        sessionId: number,
        e: React.MouseEvent,
    ) => {
        e.stopPropagation(); // Prevent navigation when clicking delete

        if (
            confirm(
                "Are you sure you want to delete this session? This action cannot be undone.",
            )
        ) {
            try {
                await api.delete(`/sessions/${sessionId}`);
                loadHistory(); // Reload sessions after deletion
            } catch (error) {
                setError("Failed to delete session.");
                console.error("Failed to delete session", error);
            }
        }
    }, [loadHistory]);

    const exportSession = useCallback(async (
        sessionId: number,
        format: "json" | "markdown" | "pdf",
        e: React.MouseEvent,
    ) => {
        e.stopPropagation();
        try {
            // Load full session messages
            const response = await api.get(`/sessions/${sessionId}/messages`);
            const messages = response.data.data;

            let content = "";
            let filename = "";
            let mimeType = "";

            if (format === "json") {
                content = JSON.stringify(messages, null, 2);
                filename = `chat-session-${sessionId}.json`;
                mimeType = "application/json";
            } else if (format === "markdown") {
                // Convert to Markdown
                content = messages
                    .map(
                        (msg: Message) =>
                            `## User\n\n${msg.content}\n\n## AI Response\n\n${msg.response}\n\n---\n`,
                    )
                    .join("\n");
                filename = `chat-session-${sessionId}.md`;
                mimeType = "text/markdown";
            }

            // Create and download file
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            setError("Failed to export session.");
            console.error("Failed to export session", error);
        }
    }, []);

    const handleSkipPrev = useCallback(() => setSkip(prev => Math.max(0, prev - limit)), [limit]);
    const handleSkipNext = useCallback(() => setSkip(prev => prev + limit), [limit]);

    return (
        <Container fluid className="vh-100 d-flex flex-column">
            <Row className="flex-grow-1">
                <Col
                    md={12}
                    className="d-flex flex-column p-4"
                    style={{ minHeight: 0 }}
                >
                    <h2 className="h4 font-weight-bold mb-4">
                        Chat Sessions Management
                    </h2>
                    <div className="mb-4">
                        <Row className="mb-3">
                            <Col md={5}>
                                <InputGroup>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search History"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSearch();
                                            }
                                        }}

                                    />
                                    <Button
                                        type="button"
                                        onClick={handleSearch}
                                        disabled={loading}
                                        variant="secondary"
                                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                                    >
                                        <Search size={16} />
                                    </Button>
                                </InputGroup>
                            </Col>

                            <Col md={4}>
                                <Form.Control
                                    type="date"
                                    placeholder="Filter by date"
                                    value={dateFilter}
                                    onChange={(e) =>
                                        setDateFilter(e.target.value)
                                    }
                                />
                            </Col>
                            <Col md={3}>
                                <Form.Select
                                    value={limit}
                                    onChange={(e) =>
                                        setLimit(Number(e.target.value))
                                    }
                                >
                                    <option value={10}>10 per page</option>
                                    <option value={50}>50 per page</option>
                                    <option value={100}>100 per page</option>
                                </Form.Select>
                            </Col>
                        </Row>
                    </div>
                    {error ? <Alert variant="danger">{error}</Alert> : null}
                    <div
                        className="flex-grow-1 mb-4"
                        style={{
                            overflowY: "auto",
                            flex: "1 1 0",
                            minHeight: 0,
                        }}
                    >
                        <ListGroup>
                            {filteredSessions.map((session) => (
                                <ListGroup.Item
                                    key={`session-${session.id}`}
                                    className={`d-flex align-items-center justify-content-between session-list-item ${pinnedSessions.has(session.id) ? "pinned-session" : ""}`}
                                    onClick={() =>
                                        handleSessionClick(session.id)
                                    }
                                    style={{ cursor: "pointer" }}
                                >
                                    {/* Left side: Title and Metadata */}
                                    <div className="d-flex align-items-center flex-grow-1">
                                        <div className="flex-grow-1">
                                            {loading ? (
                                                <div
                                                    className="skeleton-text"
                                                    style={{
                                                        height: "1.2em",
                                                        width: "60%",
                                                        backgroundColor:
                                                            "#e9ecef",
                                                        borderRadius: "4px",
                                                    }}
                                                />
                                            ) : (
                                                <>
                                                    <div
                                                        className="fw-medium text-truncate"
                                                        title={
                                                            session.title
                                                        }
                                                    >
                                                        {session.title}
                                                    </div>
                                                    <div className="small text-muted">
                                                        {new Date(
                                                            session.created_at,
                                                        ).toLocaleDateString()}{" "}
                                                        •{" "}
                                                        {
                                                            session.message_count
                                                        }{" "}
                                                        messages
                                                        {pinnedSessions.has(
                                                            session.id,
                                                        ) ? (
                                                            <span className="ms-2 badge bg-warning">
                                                                Pinned
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right side: Actions */}
                                    <div className="d-flex gap-2">
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="p-1"
                                            onClick={(e) =>
                                                togglePinSession(
                                                    session.id,
                                                    e,
                                                )
                                            }
                                            title={
                                                pinnedSessions.has(
                                                    session.id,
                                                )
                                                    ? "Unpin session"
                                                    : "Pin session"
                                            }
                                        >
                                            {pinnedSessions.has(
                                                session.id,
                                            ) ? (
                                                <PinOff
                                                    size={16}
                                                    className="text-primary"
                                                />
                                            ) : (
                                                <Pin
                                                    size={16}
                                                    className="text-muted"
                                                />
                                            )}
                                        </Button>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="p-1 text-danger"
                                            onClick={(e) =>
                                                handleSessionDelete(
                                                    session.id,
                                                    e,
                                                )
                                            }
                                            title="Delete session"
                                        >
                                            <Trash size={16} />
                                        </Button>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="p-1"
                                            onClick={(e) =>
                                                exportSession(
                                                    session.id,
                                                    "markdown",
                                                    e,
                                                )
                                            }
                                            title="Export as Markdown"
                                        >
                                            <FileDown size={16} />
                                        </Button>
                                    </div>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </div>
                    {meta ? (
                        <div className="d-flex justify-content-between">
                            <div>
                                Page {meta.page} of {meta.total_pages} (Total:{" "}
                                {meta.total})
                            </div>
                            <div>
                                <Button
                                    variant="outline-secondary"
                                    disabled={skip === 0}
                                    onClick={handleSkipPrev}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline-secondary"
                                    className="ml-2"
                                    disabled={!meta.has_more}
                                    onClick={handleSkipNext}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    <div className="mt-4">
                        <Button
                            variant="outline-info"
                            onClick={handleStream}
                            disabled={streaming}
                        >
                            {streaming ? (
                                "Streaming..."
                            ) : (
                                <>
                                    <Download size={16} /> Stream Sessions
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline-danger"
                            className="ml-2"
                            onClick={() => setShowDeleteModal(true)}
                        >
                            <Trash size={16} /> Delete Sessions
                        </Button>
                    </div>
                </Col>
            </Row>
            <Modal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
            >
                <Modal.Header closeButton>
                    <Modal.Title>Delete Chat Sessions</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>
                        Are you sure you want to delete chat sessions? This
                        action cannot be undone.
                    </p>
                    <Form.Group>
                        <Form.Label>
                            Delete sessions before date (optional)
                        </Form.Label>
                        <Form.Control
                            type="date"
                            value={deleteBeforeDate}
                            onChange={(e) =>
                                setDeleteBeforeDate(e.target.value)
                            }
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={() => setShowDeleteModal(false)}
                    >
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDelete}>
                        Delete Sessions
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default React.memo(HistoryManagement);
