import React from 'react';
import { Copy, ArrowCounterClockwise, PencilSimple, Trash } from '@phosphor-icons/react';
import type { Message } from '../../types/chat';

interface MessageContextMenuProps {
  message: Message;
  isActive: boolean;
  onClose: () => void;
  handleCopyMessage: (message: Message) => void;
  handleRegenerateResponse: (message: Message) => void;
  handleEditMessage: (message: Message) => void;
  handleDeleteMessage: (messageId: number) => void;
  messageType?: 'user' | 'assistant';
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  isActive,
  onClose,
  handleCopyMessage,
  handleRegenerateResponse,
  handleEditMessage,
  handleDeleteMessage,
  messageType = 'user',
}) => {
  if (!isActive) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const isUserMessage = messageType === 'user';
  const isAssistantMessage = messageType === 'assistant';

  return (
    <div className="message-context-menu" onClick={(e) => e.stopPropagation()}>
      {isUserMessage && (
        <>
          <button
            className="context-menu-item edit"
            onClick={() => handleAction(() => handleEditMessage(message))}
          >
            <PencilSimple size={16} />
            Edit Message
          </button>
          <div className="context-menu-separator"></div>
        </>
      )}

      {isAssistantMessage && message.response && (
        <>
          <button
            className="context-menu-item regenerate"
            onClick={() => handleAction(() => handleRegenerateResponse(message))}
          >
            <ArrowCounterClockwise size={16} />
            Regenerate Response
          </button>
          <div className="context-menu-separator"></div>
        </>
      )}

      <button
        className="context-menu-item"
        onClick={() => handleAction(() => handleCopyMessage(message))}
      >
        <Copy size={16} />
        Copy Message
      </button>

      <div className="context-menu-separator"></div>

      <button
        className="context-menu-item delete-item"
        onClick={() => handleAction(() => handleDeleteMessage(message.id))}
      >
        <Trash size={16} />
        Delete Message
      </button>
    </div>
  );
};

export default MessageContextMenu;
