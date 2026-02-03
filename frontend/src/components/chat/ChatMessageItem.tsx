import React, { useMemo, useState, useEffect } from 'react';
import { Card, ListGroup, Button } from 'react-bootstrap';
import { User, FileText } from 'lucide-react';
import Timestamp from './Timestamp';
import MessageStatus from './MessageStatus';
import MessageContextMenu from './MessageContextMenu';
import MarkdownRenderer from './MarkdownRenderer';
import GenerativeUIRenderer from './GenerativeUIRenderer';
import SourceList from './SourceList';
import type { Message } from '../../types/chat';
import type { UIContainer } from '../../types/generative-ui';

interface ChatMessageItemProps {
    msg: Message;
    streamingMessageId: number | null;
    isStreaming: boolean;
    streamingResponse: string;
    activeContextMenu: { id: number, type: 'user' | 'assistant' } | null;
    setActiveContextMenu: (menu: { id: number, type: 'user' | 'assistant' } | null) => void;
    handleCopyMessage: (message: Message) => void;
    handleRegenerateResponse: (message: Message) => void;
    handleEditMessage: (message: Message) => void;
    handleDeleteMessage: (messageId: number) => void;
    cancelStreaming: () => void;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
    msg,
    streamingMessageId,
    isStreaming,
    streamingResponse,
    activeContextMenu,
    setActiveContextMenu,
    handleCopyMessage,
    handleRegenerateResponse,
    handleEditMessage,
    handleDeleteMessage,
    cancelStreaming,
}) => {
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<{ id: number; filename: string } | null>(null);
    const versions = useMemo(() => {
        if (msg.response_versions && msg.response_versions.length > 0) return msg.response_versions;
        if (msg.response) {
            return [{
                id: msg.id,
                response: msg.response,
                created_at: msg.created_at,
                model: msg.model,
            }];
        }
        return [];
    }, [msg.response_versions, msg.response, msg.id, msg.created_at, msg.model]);

    const [activeVersionIdx, setActiveVersionIdx] = useState(
        versions.length ? versions.length - 1 : 0,
    );

    useEffect(() => {
        if (versions.length) {
            setActiveVersionIdx(versions.length - 1);
        }
    }, [versions.length, msg.id, msg.response]);

    const selectedResponse = versions[activeVersionIdx]?.response || msg.response || "";

    const responseText = (msg.id === streamingMessageId && isStreaming)
        ? streamingResponse
        : selectedResponse;

    const uiData = useMemo(() => {
        if (!responseText) return null;
        try {
            let jsonString = responseText.trim();
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
            return (parsed.type === 'container' && Array.isArray(parsed.children)) ? parsed as UIContainer : null;
        } catch (e) {
            return null;
        }
    }, [responseText]);
    
    const { displayResponse, sources } = useMemo(() => {
        const sourcesMatch = responseText.match(/\n\nSources:\n([\s\S]*)$/);
        const display = sourcesMatch ? responseText.substring(0, sourcesMatch.index) : responseText;
        const srcList = sourcesMatch ? sourcesMatch[1].trim().split('\n').map(line => {
            const m = line.match(/^\[(\d+)\] (.*)$/);
            return m ? { id: parseInt(m[1]), filename: m[2] } : null;
        }).filter((s): s is { id: number; filename: string } => s !== null) : [];
        return { displayResponse: display, sources: srcList };
    }, [responseText]);

    const isUserActive = activeContextMenu?.id === msg.id && activeContextMenu?.type === 'user';
    const isAssistantActive = activeContextMenu?.id === msg.id && activeContextMenu?.type === 'assistant';

    return (
        <ListGroup.Item className="border-0 message-item">
            {(previewImage || previewDoc) ? (
                <div className="chat-preview-backdrop" onClick={() => { setPreviewImage(null); setPreviewDoc(null); }}>
                    <div className="chat-preview-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="chat-preview-close"
                            onClick={() => { setPreviewImage(null); setPreviewDoc(null); }}
                            aria-label="Close preview"
                        >
                            ×
                        </button>
                        {previewImage ? (
                            <img src={previewImage} alt="Preview" className="chat-preview-image" />
                        ) : null}
                        {previewDoc ? (
                            <div className="chat-preview-doc">
                                <div className="chat-preview-doc-title">{previewDoc.filename}</div>
                                <iframe
                                    src={`/api/v1/chat/documents/${previewDoc.id}/preview`}
                                    title={previewDoc.filename}
                                    className="chat-preview-iframe"
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
            <div className="d-flex justify-content-end mb-2">
                <div className="d-flex flex-column align-items-end position-relative">
                    <Card
                        body
                        className="message-bubble-user"
                        style={{ width: "fit-content", maxWidth: "95%" }}
                        onClick={() => handleMessageClick(msg.id)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setActiveContextMenu({ id: msg.id, type: 'user' });
                        }}
                        onDoubleClick={(e) => {
                            e.preventDefault();
                            setActiveContextMenu({ id: msg.id, type: 'user' });
                        }}
                    >
                        {msg.images && msg.images.length > 0 ? (
                            <div className="message-images mb-2 d-flex flex-wrap gap-2">
                                {msg.images.map((img, idx) => (
                                    <img 
                                        key={idx} 
                                        src={img} 
                                        alt="Uploaded" 
                                        onClick={() => setPreviewImage(img)}
                                        className="message-image-clickable"
                                        style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' }} 
                                    />
                                ))}
                            </div>
                        ) : null}
                        {msg.documents && msg.documents.length > 0 ? (
                            <div className="message-documents mb-2 d-flex flex-column gap-1">
                                {msg.documents.map((doc, idx) => (
                                    <button
                                        key={idx}
                                        className="message-doc-item d-flex align-items-center gap-2 p-2 bg-light bg-opacity-10 rounded text-white text-start"
                                        style={{ fontSize: '0.85rem' }}
                                        onClick={() => setPreviewDoc({ id: doc.id, filename: doc.filename })}
                                    >
                                        <FileText size={16} />
                                        <span className="text-truncate" style={{ maxWidth: '200px' }}>{doc.filename}</span>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                        <div className="d-flex align-items-center">
                            <User className="me-2" />
                            {msg.content}
                        </div>
                    </Card>
                    {isUserActive ? (
                        <MessageContextMenu
                            message={msg}
                            isActive={true}
                            onClose={() => setActiveContextMenu(null)}
                            handleCopyMessage={(message) => handleCopyMessage({ ...message, response: "" })}
                            handleRegenerateResponse={handleRegenerateResponse}
                            handleEditMessage={handleEditMessage}
                            handleDeleteMessage={handleDeleteMessage}
                            messageType="user"
                        />
                    ) : null}
                    <div className="d-flex align-items-center mt-1 me-2 gap-2">
                        <Timestamp dateString={msg.created_at} />
                        <MessageStatus status={msg.status || "sent"} />
                    </div>
                </div>
            </div>
            <div className="d-flex justify-content-start">
                <div className="d-flex flex-column align-items-start position-relative" style={{ maxWidth: "100%" }}>
                    <div
                        className="message-content-assistant"
                        onClick={() => handleMessageClick(msg.id)}
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
                                {msg.tool_calls && msg.tool_calls.length > 0 ? (
                                    <div className="tool-calls mb-3">
                                        {msg.tool_calls.map((tool, idx) => (
                                            <div key={idx} className="tool-call-item text-muted small mb-1">
                                                <span className="fw-bold">🛠️ {tool.tool}</span>
                                                {tool.status === 'running' ? <span className="ms-2 spinner-border spinner-border-sm" role="status" /> : null}
                                                {tool.status === 'completed' ? <span className="ms-2 text-success">✓</span> : null}
                                                <div className="tool-input ps-3 text-truncate" style={{ maxWidth: '300px', opacity: 0.8 }}>Input: {tool.input}</div>
                                                {tool.output ? <div className="tool-output ps-3 text-truncate" style={{ maxWidth: '300px', opacity: 0.8 }}>Output: {tool.output}</div> : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                {(msg.id === streamingMessageId && isStreaming) ? (
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
                                            <MarkdownRenderer content={displayResponse} />
                                        )}
                                        {versions.length > 1 ? (
                                            <div className="d-flex align-items-center gap-2 mt-2 text-muted small">
                                                <Button
                                                    variant="outline-secondary"
                                                    size="sm"
                                                    disabled={activeVersionIdx === 0}
                                                    onClick={() => setActiveVersionIdx((idx) => Math.max(0, idx - 1))}
                                                >
                                                    &lt;
                                                </Button>
                                                <span>Version {activeVersionIdx + 1} of {versions.length}</span>
                                                <Button
                                                    variant="outline-secondary"
                                                    size="sm"
                                                    disabled={activeVersionIdx === versions.length - 1}
                                                    onClick={() => setActiveVersionIdx((idx) => Math.min(versions.length - 1, idx + 1))}
                                                >
                                                    &gt;
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                                <SourceList sources={sources} />
                            </div>
                        </div>
                    </div>
                    {isAssistantActive ? (
                        <MessageContextMenu
                            message={msg}
                            isActive={true}
                            onClose={() => setActiveContextMenu(null)}
                            handleCopyMessage={(message) => handleCopyMessage({ ...message, response: selectedResponse })}
                            handleRegenerateResponse={handleRegenerateResponse}
                            handleEditMessage={handleEditMessage}
                            handleDeleteMessage={handleDeleteMessage}
                            messageType="assistant"
                        />
                    ) : null}
                    <div className="d-flex align-items-center justify-content-between mt-1 ms-2">
                        <Timestamp dateString={msg.created_at} className="me-2" />
                        {(msg.id === streamingMessageId && isStreaming) ? (
                            <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={cancelStreaming}
                                className="cancel-streaming-btn"
                                title="Cancel streaming"
                            >
                                ✕
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
        </ListGroup.Item>
    );
};

export default React.memo(ChatMessageItem);
