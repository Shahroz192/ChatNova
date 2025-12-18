import React from 'react';
import { Copy, RotateCcw, Edit, Trash2 } from 'lucide-react';
import type { Message } from '../../types/chat';

interface MessageContextMenuProps {
  message: Message;
  isActive: boolean;
  onClose: () => void;
  handleCopyMessage: (message: Message) => void;
  handleRegenerateResponse: (message: Message) => void;
  handleEditMessage: (message: Message) => void;
  handleDeleteMessage: (messageId: number) => void;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  isActive,
  onClose,
  handleCopyMessage,
  handleRegenerateResponse,
  handleEditMessage,
  handleDeleteMessage,
}) => {
  if (!isActive) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const isUserMessage = !!message.content;

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
            className="context-menu-item regenerate"
            onClick={() => handleAction(() => handleRegenerateResponse(message))}
          >
            <RotateCcw size={16} />
            Regenerate Response
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
