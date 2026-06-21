import React, { useState, useEffect } from "react";
import { Trash, Brain, ArrowsClockwise } from "@phosphor-icons/react";
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
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div
                    style={{
                        width: 24, height: 24,
                        border: '2px solid var(--border-light, #e8e5df)',
                        borderTopColor: 'var(--text-primary, #1c1917)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto 12px'
                    }}
                />
                <p className="settings-hint" style={{ margin: 0 }}>Retrieving your memories...</p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button
                    onClick={fetchMemories}
                    disabled={loading}
                    className="settings-btn settings-btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                    <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {error && <div className="settings-alert settings-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

            {memories.length === 0 ? (
                <div className="settings-empty">
                    <div className="settings-empty-icon">
                        <Brain size={40} weight="light" />
                    </div>
                    <p className="settings-empty-title">No memories stored yet</p>
                    <p className="settings-empty-desc">Chat with the AI to start building your personal context.</p>
                </div>
            ) : (
                <div className="settings-memory-list">
                    {memories.map((memory) => (
                        <div key={memory.id} className="settings-memory-item">
                            <Brain size={18} weight="light" style={{ color: 'var(--text-tertiary, #a8a29e)', marginTop: 2, flexShrink: 0 }} />
                            <div className="settings-memory-content">
                                <p className="settings-memory-text">{memory.content}</p>
                                <p className="settings-memory-date">
                                    Learned on {new Date(memory.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => handleDelete(memory.id)}
                                disabled={deletingId === memory.id}
                                className="settings-btn settings-btn-danger"
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                title="Delete this memory"
                            >
                                {deletingId === memory.id ? (
                                    <div
                                        style={{
                                            width: 14, height: 14,
                                            border: '2px solid currentColor',
                                            borderTopColor: 'transparent',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite'
                                        }}
                                    />
                                ) : (
                                    <Trash size={14} />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div style={{
                marginTop: 16,
                padding: '10px 14px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary, #78716c)',
                background: 'var(--bg-tertiary, #e8e5df)',
                border: '1px solid var(--border-light, #e8e5df)',
                borderRadius: 'var(--radius-sm)',
                lineHeight: 1.4,
            }}>
                <strong>Pro-tip:</strong> You can explicitly tell the AI to "remember" something, or it will pick up facts naturally as you talk.
            </div>
        </div>
    );
};

export default MemoryManagement;
