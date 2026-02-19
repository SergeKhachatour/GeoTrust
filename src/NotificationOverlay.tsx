import React, { useEffect } from 'react';
import './NotificationOverlay.css';

interface NotificationOverlayProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  autoClose?: number; // milliseconds, 0 = no auto close
}

export const NotificationOverlay: React.FC<NotificationOverlayProps> = ({
  isOpen,
  title,
  message,
  type = 'info',
  onClose,
  autoClose = 5000,
}) => {
  useEffect(() => {
    if (isOpen && autoClose > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoClose);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className="notification-overlay" onClick={onClose}>
      <div className={`notification-modal notification-${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="notification-header">
          <div className="notification-icon">{getIcon()}</div>
          <h3>{title}</h3>
          <button className="notification-close" onClick={onClose}>×</button>
        </div>
        <div className="notification-body">
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
};
