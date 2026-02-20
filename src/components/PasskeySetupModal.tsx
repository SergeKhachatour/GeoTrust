import React, { useState, useEffect } from 'react';
import { passkeyService } from '../services/passkeyService';
import { NotificationOverlay } from '../NotificationOverlay';
import './PasskeySetupModal.css';

interface PasskeySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasskeyEnabled: (credentialId: string) => void;
  publicKey: string;
}

export const PasskeySetupModal: React.FC<PasskeySetupModalProps> = ({
  isOpen,
  onClose,
  onPasskeyEnabled,
  publicKey,
}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  useEffect(() => {
    if (isOpen) {
      const checkSupport = async () => {
        const supported = passkeyService.isSupported();
        setIsSupported(supported);
        
        if (supported) {
          const available = await passkeyService.isAvailable();
          setIsAvailable(available);
        }
      };
      
      checkSupport();
    }
  }, [isOpen]);

  const handleEnablePasskey = async () => {
    if (!isSupported || !isAvailable) {
      return;
    }

    setIsLoading(true);
    setStatus('loading');
    setStatusMessage('Setting up your passkey...');

    try {
      const userId = `geotrust-user-${publicKey.slice(-8)}`;
      const registration = await passkeyService.registerPasskey(userId);
      
      // Store the passkey data
      await passkeyService.storePasskeyData(registration.credentialId, registration.publicKey);
      
      setStatus('success');
      setStatusMessage('Passkey successfully created!');
      
      setNotification({
        isOpen: true,
        title: 'Success',
        message: 'Passkey authentication enabled!',
        type: 'success',
      });
      
      // Call the callback after a short delay
      setTimeout(() => {
        onPasskeyEnabled(registration.credentialId);
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error('Passkey registration failed:', error);
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to create passkey');
      setNotification({
        isOpen: true,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to enable passkey',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="passkey-setup-modal-backdrop" onClick={onClose}>
        <div className="passkey-setup-modal" onClick={(e) => e.stopPropagation()}>
          <div className="passkey-setup-modal-header">
            <h2>🔐 Secure Your Wallet with Passkey</h2>
            <button className="passkey-setup-modal-close" onClick={onClose}>×</button>
          </div>
          
          <div className="passkey-setup-modal-body">
            <p className="passkey-setup-modal-description">
              Enable passkey authentication for enhanced security. Use biometric authentication (Touch ID, Face ID, Windows Hello) to access your wallet.
            </p>

            <div className="passkey-setup-features">
              <div className="passkey-setup-feature">
                <span className="feature-icon">👆</span>
                <div>
                  <strong>Biometric Authentication</strong>
                  <p>Use Touch ID, Face ID, or Windows Hello</p>
                </div>
              </div>
              
              <div className="passkey-setup-feature">
                <span className="feature-icon">🔒</span>
                <div>
                  <strong>Enhanced Security</strong>
                  <p>More secure than traditional passwords</p>
                </div>
              </div>
              
              <div className="passkey-setup-feature">
                <span className="feature-icon">⚡</span>
                <div>
                  <strong>Quick Access</strong>
                  <p>Fast and convenient wallet authentication</p>
                </div>
              </div>
            </div>

            {status !== 'idle' && (
              <div className={`passkey-setup-status status-${status}`}>
                {status === 'loading' && <span className="spinner">⏳</span>}
                {status === 'success' && <span>✅</span>}
                {status === 'error' && <span>❌</span>}
                {statusMessage}
              </div>
            )}

            {!isSupported && (
              <div className="passkey-setup-warning">
                ⚠️ Your browser doesn't support passkeys
              </div>
            )}

            {isSupported && !isAvailable && (
              <div className="passkey-setup-warning">
                ⚠️ No biometric sensor found on this device
              </div>
            )}
          </div>

          <div className="passkey-setup-modal-footer">
            <button 
              className="secondary-button" 
              onClick={onClose}
              style={{ marginRight: '10px' }}
            >
              Skip for Now
            </button>
            <button 
              className="primary-button" 
              onClick={handleEnablePasskey}
              disabled={!isSupported || !isAvailable || isLoading}
            >
              {isLoading ? 'Setting up...' : 'Enable Passkey'}
            </button>
          </div>
        </div>
      </div>

      <NotificationOverlay
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        autoClose={3000}
      />
    </>
  );
};
