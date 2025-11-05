import React from 'react';
import { Check, CheckCheck, X, Clock } from 'lucide-react';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

interface MessageStatusProps {
  status: MessageStatus;
  className?: string;
}

const MessageStatus: React.FC<MessageStatusProps> = ({ status, className = '' }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Clock size={12} className="text-warning" />;
      case 'sent':
        return <Check size={12} className="text-muted" />;
      case 'delivered':
        return <CheckCheck size={12} className="text-success" />;
      case 'failed':
        return <X size={12} className="text-danger" />;
      default:
        return <Check size={12} className="text-muted" />;
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
      className={`d-flex align-items-center message-status ${className}`}
      title={getStatusText()}
    >
      {getStatusIcon()}
    </div>
  );
};

export default MessageStatus;
