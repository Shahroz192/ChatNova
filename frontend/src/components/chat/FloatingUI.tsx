import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import type { ReactNode } from "react";

interface FloatingUIProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  position?: 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const FloatingUI: React.FC<FloatingUIProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close when clicking outside the content
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
        transition: 'background-color 0.3s ease',
        zIndex: 9999,
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={containerRef}
        style={{
          backgroundColor: 'var(--bg-primary, #ffffff)',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '32rem',
          transform: isVisible ? 'scale(1)' : 'scale(0.95)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: '90vh',
          border: '1px solid var(--border-light, #e5e5e5)',
          overflow: 'hidden',
        }}
        role="document"
        aria-labelledby="floatingui-title"
      >
        <div 
          style={{ 
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #e5e5e5)',
            backgroundColor: 'var(--bg-secondary, #f5f5f5)',
          }}
        >
          <h3 
            id="floatingui-title" 
            style={{ 
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary, #1a1a1a)',
            }}
          >
            {title}
          </h3>
        </div>
        <div 
          style={{ 
            padding: '1.5rem',
            overflowY: 'auto', 
            maxHeight: 'calc(90vh - 80px)',
            backgroundColor: 'var(--bg-primary, #ffffff)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level
  return ReactDOM.createPortal(modalContent, document.body);
};

export default FloatingUI;