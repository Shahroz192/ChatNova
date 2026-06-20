import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, WarningCircle, Warning, Info } from '@phosphor-icons/react';
import '../../styles/Toast.css';

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
        return <CheckCircle size={20} />;
      case 'error':
        return <WarningCircle size={20} />;
      case 'warning':
        return <Warning size={20} />;
      case 'info':
        return <Info size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  const getToastClasses = () => {
    const baseClasses = "toast-custom d-flex align-items-center gap-2 px-3 py-2";
    const typeClasses = {
      success: 'text-success-emphasis',
      error: 'text-danger-emphasis',
      warning: 'text-warning-emphasis',
      info: 'text-info-emphasis'
    };

    const animationClasses = isLeaving
      ? 'toast-exit'
      : isVisible
        ? 'toast-enter'
        : 'toast-hidden';

    return `${baseClasses} ${typeClasses[toast.type]} ${animationClasses}`;
  };

  return (
    <div className={getToastClasses()} style={{ background: 'var(--bg-primary, #ffffff)', border: '1px solid var(--border-light, #e8e5df)', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxWidth: '320px' }}>
      {getIcon()}
      <span className="flex-grow-1 text-sm fw-medium" style={{ color: 'var(--text-primary, #1c1917)' }}>{toast.title}{toast.message ? ` — ${toast.message}` : ''}</span>
      <button
        type="button"
        className="btn-toast-close opacity-40"
        onClick={handleClose}
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
});

export default Toast;
