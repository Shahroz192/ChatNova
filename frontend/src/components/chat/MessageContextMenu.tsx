import React from 'react';
import { Copy, RotateCcw, Bookmark, BookmarkCheck, Edit, Trash2 } from 'lucide-react';
import type { Message } from '../../types/chat';

interface MessageContextMenuProps {
  message: Message;
  isActive: boolean;
  onClose: () => void;
  bookmarkedMessages: number[];
  handleCopyMessage: (message: Message) => void;
  handleCopyAsCode: (message: Message) => void;
  handleRegenerateResponse: (message: Message) => void;
  handleBookmarkMessage: (messageId: number) => void;
  handleEditMessage: (message: Message) => void;
  handleDeleteMessage: (messageId: number) => void;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  isActive,
  onClose,
  bookmarkedMessages,
  handleCopyMessage,
  handleCopyAsCode,
  handleRegenerateResponse,
  handleBookmarkMessage,
  handleEditMessage,
  handleDeleteMessage,
}) => {
  if (!isActive) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const isUserMessage = message.content && !message.response;
  const isBookmarked = bookmarkedMessages.includes(message.id);

  return (
    <div className="message-context-menu" onClick={(e) => e.stopPropagation()}>
      <button
        className="context-menu-item"
        onClick={() => handleAction(() => handleCopyMessage(message))}
      >
        <Copy size={16} />
        Copy Message
      </button>

      {message.response && (
        <>
          <button
            className="context-menu-item copy-code"
            onClick={() => handleAction(() => handleCopyAsCode(message))}
          >
            <Copy size={16} />
            Copy as Code
          </button>

          <button
            className="context-menu-item regenerate"
            onClick={() => handleAction(() => handleRegenerateResponse(message))}
          >
            <RotateCcw size={16} />
            Regenerate Response
          </button>

          <div className="context-menu-separator"></div>

          <button
            className="context-menu-item bookmark"
            onClick={() => handleAction(() => handleBookmarkMessage(message.id))}
          >
            {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            {isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
          </button>
        </>
      )}

      {isUserMessage && (
        <>
          <div className="context-menu-separator"></div>
          <button
            className="context-menu-item edit"
            onClick={() => handleAction(() => handleEditMessage(message))}
          >
            <Edit size={16} />
            Edit Message
          </button>
        </>
      )}

      <div className="context-menu-separator"></div>

      <button
        className="context-menu-item delete-item"
        onClick={() => handleAction(() => handleDeleteMessage(message.id))}
      >
        <Trash2 size={16} />
        Delete Message
      </button>
    </div>
  );
};

export default MessageContextMenu;
