import React, { useState, useEffect, useRef } from "react";
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
  position = 'center' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const containerRef = useRef<HTMLDivElement>(null);

  // Position classes mapping
  const positionClasses = {
    'center': 'fixed inset-0 flex items-center justify-center z-50 p-4',
    'top-right': 'fixed top-4 right-4 z-50 w-full max-w-md',
    'top-left': 'fixed top-4 left-4 z-50 w-full max-w-md',
    'bottom-right': 'fixed bottom-4 right-4 z-50 w-full max-w-md',
    'bottom-left': 'fixed bottom-4 left-4 z-50 w-full max-w-md',
  };

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

  const positionClass = positionClasses[position];
  const isCentered = position === 'center';

  return (
    <div
      className={`${positionClass} transition-opacity duration-300 ${
        isVisible ? (isCentered ? 'bg-black bg-opacity-50' : '') : (isCentered ? 'bg-opacity-0' : '')
      }`}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={containerRef}
        className={`card w-full max-w-md transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        } ${isCentered ? 'relative' : 'absolute'}`}
        role="document"
        aria-labelledby="floatingui-title"
      >
        <div className="card-header flex justify-between items-center">
          <h3 id="floatingui-title" className="text-xl font-semibold">{title}</h3>
        </div>
        <div className="card-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FloatingUI;