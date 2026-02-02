import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = React.memo(({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleClose = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => onClose(toast.id), 300); // Match animation duration
  }, [onClose, toast.id]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle size={20} className="text-success" />;
      case 'error':
        return <AlertCircle size={20} className="text-danger" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-warning" />;
      case 'info':
        return <Info size={20} className="text-info" />;
      default:
        return <Info size={20} className="text-info" />;
    }
  };

  const getToastClasses = () => {
    const baseClasses = "toast-custom d-flex align-items-start p-3 mb-2 border-0 shadow-sm";
    const typeClasses = {
      success: 'bg-success-subtle border-success',
      error: 'bg-danger-subtle border-danger',
      warning: 'bg-warning-subtle border-warning',
      info: 'bg-info-subtle border-info'
    };

    const animationClasses = isLeaving
      ? 'toast-exit'
      : isVisible
        ? 'toast-enter'
        : 'toast-hidden';

    return `${baseClasses} ${typeClasses[toast.type]} ${animationClasses}`;
  };

  return (
    <div className={getToastClasses()} style={{ maxWidth: '400px', borderRadius: '8px' }}>
      <div className="me-2 mt-1">
        {getIcon()}
      </div>
      <div className="flex-grow-1">
        <div className="fw-semibold small">{toast.title}</div>
        {toast.message ? <div className="small opacity-75 mt-1">{toast.message}</div> : null}
      </div>
      <button
        type="button"
        className="btn-close btn-close-sm ms-2 mt-1 opacity-50"
        onClick={handleClose}
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
});

export default Toast;
