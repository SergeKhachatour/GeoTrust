import React from 'react';
import './ConfirmationOverlay.css';

interface ConfirmationOverlayProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmationOverlay: React.FC<ConfirmationOverlayProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'info',
}) => {
  if (!isOpen) return null;

  const getButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'confirmation-button-danger';
      case 'warning':
        return 'confirmation-button-warning';
      default:
        return 'confirmation-button-primary';
    }
  };

  return (
    <div className="confirmation-overlay" onClick={onCancel}>
      <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirmation-header">
          <h3>{title}</h3>
          <button className="confirmation-close" onClick={onCancel}>×</button>
        </div>
        <div className="confirmation-body">
          <p>{message}</p>
        </div>
        <div className="confirmation-footer">
          <button className="confirmation-button-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={getButtonClass()} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
