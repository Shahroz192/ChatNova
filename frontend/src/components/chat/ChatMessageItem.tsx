import React, { useMemo, useState, useEffect } from 'react';
import { FileText } from '@phosphor-icons/react';
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
  msgIndex?: number;
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
  msgIndex = 0,
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

  const { displayResponse, sources } = useMemo(() => {
    const sourcesMatch = responseText.match(/\n\nSources:\n([\s\S]*)$/);
    const display = sourcesMatch ? responseText.substring(0, sourcesMatch.index) : responseText;
    const srcList = sourcesMatch ? sourcesMatch[1].trim().split('\n').map(line => {
      const m = line.match(/^\[(\d+)\] (.*)$/);
      return m ? { id: parseInt(m[1]), filename: m[2] } : null;
    }).filter((s): s is { id: number; filename: string } => s !== null) : [];
    return { displayResponse: display, sources: srcList };
  }, [responseText]);

  // Extract UI container from structured output (backend) or inline JSON in the text (legacy)
  const { uiData, displayTextWithoutUI } = useMemo(() => {
    // Priority 1: Backend-validated structured output
    if (msg.ui_data && msg.ui_data.type === 'container') {
      return { uiData: msg.ui_data as UIContainer, displayTextWithoutUI: displayResponse };
    }

    // Priority 2: Legacy — extract inline ```json block from the text
    if (!displayResponse) return { uiData: null, displayTextWithoutUI: displayResponse };

    const jsonBlockMatch = displayResponse.match(/```json\n[\s\S]*?\n```/);
    if (jsonBlockMatch) {
      const jsonString = jsonBlockMatch[0];
      const innerJson = jsonString.replace(/```json\n/, '').replace(/\n```/, '');
      try {
        const parsed = JSON.parse(innerJson);
        if (parsed.type === 'container' && Array.isArray(parsed.children)) {
          // Remove the JSON block from the display text so it doesn't show raw JSON
          const textWithoutUI = displayResponse.replace(jsonBlockMatch[0], '').trim();
          return { uiData: parsed as UIContainer, displayTextWithoutUI: textWithoutUI };
        }
      } catch (e) {
        // Invalid JSON in block, fall through
      }
    }

    // Fallback: try to find a bare JSON object in the text
    try {
      const firstBrace = displayResponse.indexOf('{');
      const lastBrace = displayResponse.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const candidate = displayResponse.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(candidate);
        if (parsed.type === 'container' && Array.isArray(parsed.children)) {
          const textWithoutUI = displayResponse.replace(candidate, '').trim();
          return { uiData: parsed as UIContainer, displayTextWithoutUI: textWithoutUI };
        }
      }
    } catch (e) {
      // Not valid JSON
    }

    return { uiData: null, displayTextWithoutUI: displayResponse };
  }, [displayResponse, msg.ui_data]);

  const isUserActive = activeContextMenu?.id === msg.id && activeContextMenu?.type === 'user';
  const isAssistantActive = activeContextMenu?.id === msg.id && activeContextMenu?.type === 'assistant';

  return (
    <div className="message-item" style={{ '--msg-index': msgIndex } as React.CSSProperties}>
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
      <div className="flex justify-end mb-2">
        <div className="flex flex-col items-end relative">
          <div
            className="message-bubble-user"
            onClick={() => setActiveContextMenu(null)}
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
              <div className="flex flex-wrap gap-2 mb-2">
                {msg.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt="Uploaded"
                    onClick={() => setPreviewImage(img)}
                    className="message-image-clickable"
                    style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: 'var(--radius-xs)', objectFit: 'cover' }}
                  />
                ))}
              </div>
            ) : null}
            {msg.documents && msg.documents.length > 0 ? (
              <div className="flex flex-col gap-1 mb-2">
                {msg.documents.map((doc, idx) => (
                  <button
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded text-white text-start"
                    style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.08)' }}
                    onClick={() => setPreviewDoc({ id: doc.id, filename: doc.filename })}
                  >
                    <FileText size={16} />
                    <span className="truncate" style={{ maxWidth: '200px' }}>{doc.filename}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {msg.content}
          </div>
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
          <div className="flex items-center mt-1.5 mr-2 gap-2.5">
            <Timestamp dateString={msg.created_at} />
            <MessageStatus status={msg.status || "sent"} />
          </div>
        </div>
      </div>
      <div className="flex justify-start">
        <div className="flex flex-col items-start relative" style={{ maxWidth: "100%", minWidth: 0 }}>
          <div
            className="message-content-assistant"
            onClick={() => setActiveContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setActiveContextMenu({ id: msg.id, type: 'assistant' });
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              setActiveContextMenu({ id: msg.id, type: 'assistant' });
            }}
          >
            <div className="message-bubble-assistant">
            <div className="flex w-full" style={{ minWidth: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
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
                    <MarkdownRenderer content={displayResponse + '▋'} />
                  </div>
                ) : (
                  <div className="flex-1 w-full">
                    {displayTextWithoutUI ? (
                      <MarkdownRenderer content={displayTextWithoutUI} />
                    ) : null}
                    {uiData ? (
                      <div className="generative-ui-container mt-2 mb-2 w-100">
                        <GenerativeUIRenderer data={uiData} />
                      </div>
                    ) : null}
                    {versions.length > 1 ? (
                      <div className="flex items-center gap-2 mt-2 text-gray-500 text-sm">
                        <button
                          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                          disabled={activeVersionIdx === 0}
                          onClick={() => setActiveVersionIdx((idx) => Math.max(0, idx - 1))}
                        >
                          &lt;
                        </button>
                        <span>Version {activeVersionIdx + 1} of {versions.length}</span>
                        <button
                          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                          disabled={activeVersionIdx === versions.length - 1}
                          onClick={() => setActiveVersionIdx((idx) => Math.min(versions.length - 1, idx + 1))}
                        >
                          &gt;
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
                <SourceList sources={sources} />
              </div>
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
          <div className="flex items-center justify-between mt-1.5 ml-2">
            <Timestamp dateString={msg.created_at} className="mr-2" />
            {(msg.id === streamingMessageId && isStreaming) ? (
              <button
                onClick={cancelStreaming}
                className="px-2 py-0.5 text-xs border border-red-400/50 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Cancel streaming"
              >
                ✕ Stop
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChatMessageItem);
