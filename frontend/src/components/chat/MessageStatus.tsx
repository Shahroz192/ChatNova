import React from 'react';
import { Check, Checks, X, Clock } from '@phosphor-icons/react';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

interface MessageStatusProps {
  status: MessageStatus;
  className?: string;
}

const MessageStatus: React.FC<MessageStatusProps> = ({ status, className = '' }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Clock size={12} className="text-yellow-500" />;
      case 'sent':
        return <Check size={12} className="text-gray-500" />;
      case 'delivered':
        return <Checks size={12} className="text-green-500" />;
      case 'failed':
        return <X size={12} className="text-red-500" />;
      default:
        return <Check size={12} className="text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'sending':
        return 'Sending...';
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'failed':
        return 'Failed to send';
      default:
        return 'Sent';
    }
  };

  return (
    <div
      className={`flex items-center message-status ${className}`}
      title={getStatusText()}
    >
      {getStatusIcon()}
    </div>
  );
};

export default MessageStatus;
