import React, { useState, useEffect } from "react";
import { ListGroup, Button, Alert, Spinner, Card } from "react-bootstrap";
import { Trash2, Brain, RefreshCw } from "lucide-react";
import api from "../../utils/api";

interface Memory {
    id: number;
    content: string;
    created_at: string;
}

const MemoryManagement: React.FC = () => {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchMemories();
    }, []);

    const fetchMemories = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/memories");
            setMemories(response.data);
        } catch (err) {
            console.error("Failed to fetch memories", err);
            setError("Failed to load your memories.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        setDeletingId(id);
        try {
            await api.delete(`/memories/${id}`);
            setMemories(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            console.error("Failed to delete memory", err);
            setError("Failed to delete memory.");
        } finally {
            setDeletingId(null);
        }
    };

    if (loading && memories.length === 0) {
        return (
            <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2 text-muted">Retrieving your memories...</p>
            </div>
        );
    }

    return (
        <div className="memory-management">
            <div className="mb-4 d-flex justify-content-between align-items-center">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1 flex align-items-center gap-2">
                        <Brain size={20} className="text-primary" />
                        Memory Management
                    </h3>
                    <p className="text-sm text-gray-600 mb-0">
                        View and manage the facts ChatNova has learned about you.
                    </p>
                </div>
                <Button 
                    variant="link" 
                    onClick={fetchMemories} 
                    disabled={loading}
                    className="p-0 text-decoration-none d-flex align-items-center gap-1"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    Refresh
                </Button>
            </div>

            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

            {memories.length === 0 ? (
                <Card className="border-dashed bg-light">
                    <Card.Body className="text-center py-5">
                        <Brain size={48} className="text-muted mb-3 opacity-20" />
                        <p className="text-muted mb-0">No memories stored yet.</p>
                        <small className="text-muted">Chat with the AI to start building your personal context.</small>
                    </Card.Body>
                </Card>
            ) : (
                <ListGroup variant="flush" className="border rounded-lg overflow-hidden">
                    {memories.map((memory) => (
                        <ListGroup.Item 
                            key={memory.id}
                            className="d-flex justify-content-between align-items-start py-3"
                        >
                            <div className="flex-grow-1 pr-3">
                                <p className="mb-1 text-gray-800">{memory.content}</p>
                                <small className="text-muted">
                                    Learned on {new Date(memory.created_at).toLocaleDateString()}
                                </small>
                            </div>
                            <Button 
                                variant="outline-danger" 
                                size="sm"
                                onClick={() => handleDelete(memory.id)}
                                disabled={deletingId === memory.id}
                                className="border-0 p-2"
                                title="Delete this memory"
                            >
                                {deletingId === memory.id ? (
                                    <Spinner animation="border" size="sm" />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                            </Button>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
            
            <div className="mt-4 alert alert-info py-2 px-3 border-0 bg-opacity-10">
                <small className="d-block">
                    <strong>Pro-tip:</strong> You can explicitly tell the AI to "remember" something, or it will pick up facts naturally as you talk.
                </small>
            </div>
        </div>
    );
};

export default MemoryManagement;
