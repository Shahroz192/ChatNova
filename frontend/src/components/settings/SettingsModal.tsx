import React, { useState, useEffect } from 'react';
import { X, Key, HardDrives, Sparkle, User } from '@phosphor-icons/react';
import BYOKForm from './BYOKForm';
import MCPServerForm from './MCPServerForm';
import MCPServerList from './MCPServerList';
import PersonalizationForm from './PersonalizationForm';
import MemoryManagement from './MemoryManagement';
import AccountSettingsForm from './AccountSettingsForm';
import '../../styles/Settings.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'keys' | 'personalization' | 'servers' | 'account';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'keys', label: 'API Keys', icon: Key },
  { id: 'personalization', label: 'Personalization', icon: Sparkle },
  { id: 'servers', label: 'MCP Servers', icon: HardDrives },
  { id: 'account', label: 'Account', icon: User },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('keys');

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div
        className="settings-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 900,
          width: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-light, #e8e5df)',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-family-display, Satoshi, system-ui, sans-serif)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary, #1c1917)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Settings
          </h2>
          <button
            onClick={onClose}
            className="settings-btn settings-btn-secondary"
            style={{ padding: '8px', width: 36, height: 36, justifyContent: 'center' }}
            aria-label="Close settings"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar nav */}
          <nav
            style={{
              width: 200,
              flexShrink: 0,
              padding: '16px 8px',
              borderRight: '1px solid var(--border-light, #e8e5df)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`settings-nav-btn ${activeTab === item.id ? 'active' : ''}`}
                >
                  <span className="settings-nav-icon">
                    <Icon size={18} weight={activeTab === item.id ? 'bold' : 'regular'} />
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div
            style={{
              flex: 1,
              padding: '20px 24px',
              overflowY: 'auto',
              minHeight: 0,
            }}
          >
            {activeTab === 'keys' && (
              <div>
                <h3 className="settings-card-title" style={{ marginBottom: 16 }}>
                  <Key size={18} weight="bold" />
                  API Keys
                </h3>
                <BYOKForm />
              </div>
            )}

            {activeTab === 'personalization' && (
              <div>
                <h3 className="settings-card-title" style={{ marginBottom: 16 }}>
                  <Sparkle size={18} weight="bold" />
                  Custom Instructions
                </h3>
                <PersonalizationForm />
                <div style={{ marginTop: 32 }}>
                  <h3 className="settings-card-title" style={{ marginBottom: 16 }}>
                    Long-term Memory
                  </h3>
                  <MemoryManagement />
                </div>
              </div>
            )}

            {activeTab === 'servers' && (
              <div>
                <h3 className="settings-card-title" style={{ marginBottom: 16 }}>
                  <HardDrives size={18} weight="bold" />
                  MCP Servers
                </h3>
                <div style={{ marginBottom: 20 }}>
                  <MCPServerForm />
                </div>
                <MCPServerList />
              </div>
            )}

            {activeTab === 'account' && (
              <div>
                <h3 className="settings-card-title" style={{ marginBottom: 16 }}>
                  <User size={18} weight="bold" />
                  Account Settings
                </h3>
                <AccountSettingsForm />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
