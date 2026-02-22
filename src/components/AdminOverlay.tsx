import React from 'react';
import { AdminPanel } from '../AdminPanel';
import mapboxgl from 'mapbox-gl';
import './AdminOverlay.css';

interface AdminOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  contractClient: any;
  allowedCountries: Set<number>;
  defaultAllowAll: boolean;
  onCountryToggle: () => void;
  map: mapboxgl.Map | null;
  walletAddress: string | null;
  mainAdminAddress: string | null;
  onAdminChanged?: () => void;
  onManageCountry?: (country: { code: number; name: string }) => void;
}

export const AdminOverlay: React.FC<AdminOverlayProps> = ({
  isOpen,
  onClose,
  contractClient,
  allowedCountries,
  defaultAllowAll,
  onCountryToggle,
  map,
  walletAddress,
  mainAdminAddress,
  onAdminChanged,
  onManageCountry,
}) => {
  if (!isOpen) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="admin-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <h2>Admin Panel</h2>
          <button className="overlay-close-button" onClick={onClose}>×</button>
        </div>
        <div className="admin-overlay-content">
          <AdminPanel
            contractClient={contractClient}
            allowedCountries={allowedCountries}
            defaultAllowAll={defaultAllowAll}
            onCountryToggle={onCountryToggle}
            map={map}
            minimized={false}
            walletAddress={walletAddress}
            mainAdminAddress={mainAdminAddress}
            onAdminChanged={onAdminChanged}
            onManageCountry={onManageCountry}
          />
        </div>
      </div>
    </div>
  );
};
