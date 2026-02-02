import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface NotificationProps {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = React.memo(({ type, message, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    // Trigger animation on mount
    const entryTimer = setTimeout(() => setIsVisible(true), 10);
    
    const autoCloseTimer = setTimeout(handleClose, 5000);
    
    return () => {
      clearTimeout(entryTimer);
      clearTimeout(autoCloseTimer);
    };
  }, [handleClose]);

  const bgColor = useMemo(() => type === 'success' 
    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', [type]);
  
  const textColor = useMemo(() => type === 'success'
    ? 'text-green-800 dark:text-green-300'
    : 'text-red-800 dark:text-red-300', [type]);

  const Icon = useMemo(() => type === 'success' ? CheckCircle : XCircle, [type]);

  return (
    <div 
      className={`fixed top-4 right-4 z-50 transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      style={{ maxWidth: '400px' }}
    >
      <div className={`${bgColor} ${textColor} p-4 rounded-lg shadow-lg border flex items-start space-x-3`}>
        <Icon size={20} className="flex-shrink-0 mt-0.5" />
        <span className="flex-1 text-sm font-medium">{message}</span>
        <button 
          onClick={handleClose}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
          aria-label="Close notification"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
});

export default Notification;