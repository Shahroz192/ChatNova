import React, { useState, useEffect, useCallback } from 'react';
import { Warning, Trash } from '@phosphor-icons/react';
import api from '../../utils/api';

interface User {
  id: number;
  email: string;
  messages_used: number;
  created_at?: string;
}

// ── Delete Account Modal ──────────────────────────────────────────
const DeleteAccountModal: React.FC<{
  show: boolean;
  email: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string;
}> = ({ show, email, onClose, onConfirm, loading, error }) => {
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    if (!show) setConfirmInput('');
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  const isConfirmed = confirmInput === email;

  if (!show) return null;

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <Warning size={20} weight="fill" style={{ color: 'var(--error, #ef4444)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--error, #ef4444)', margin: 0 }}>
            Delete Account
          </h3>
        </div>
        <div className="settings-modal-body">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #78716c)', lineHeight: 1.5, margin: '0 0 16px' }}>
            This will permanently delete your account and all associated data — including chat history, memories, API keys, and MCP server configurations. This action <strong>cannot</strong> be undone.
          </p>
          <label className="settings-label" style={{ marginBottom: 8 }}>
            Type <strong>{email}</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={email}
            className="settings-input"
          />
          {error && (
            <div className="settings-alert settings-alert-error" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>
        <div className="settings-modal-footer">
          <button onClick={onClose} disabled={loading} className="settings-btn settings-btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmed || loading}
            className="settings-btn settings-btn-danger"
            style={{ fontWeight: 600 }}
          >
            {loading ? 'Deleting...' : 'Permanently Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Account Settings Form ─────────────────────────────────────────
const AccountSettingsForm: React.FC = React.memo(() => {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/users/me');
        setUser(response.data);
        setName(response.data.email.split('@')[0] || '');
        setEmail(response.data.email);
      } catch {
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (password && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const updateData: any = {};
      if (email !== user?.email) {
        updateData.email = email;
      }

      if (Object.keys(updateData).length > 0) {
        await api.put('/users/me', updateData);
        setMessage('Account updated successfully');
      } else {
        setMessage('No changes to save');
      }

      if (password) {
        setMessage('Password update functionality would be implemented here');
      }
    } catch {
      setError('Failed to update account');
    }
  }, [password, confirmPassword, email, user?.email]);

  const handleDeleteAccount = useCallback(async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/users/me');
      window.location.href = '/login';
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete account');
      setDeleting(false);
    }
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-secondary, #78716c)', fontSize: '0.875rem' }}>Loading...</div>;
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && <div className="settings-alert settings-alert-error">{error}</div>}

      <div>
        <label className="settings-label" htmlFor="formName">Name</label>
        <input
          id="formName"
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="settings-input"
        />
      </div>

      <div>
        <label className="settings-label" htmlFor="formEmail">Email address</label>
        <input
          id="formEmail"
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="settings-input"
        />
      </div>

      <div>
        <label className="settings-label" htmlFor="formPassword">New Password</label>
        <input
          id="formPassword"
          type="password"
          placeholder="Leave blank to keep current"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="settings-input"
        />
        <p className="settings-hint">Leave blank to keep your current password.</p>
      </div>

      <div>
        <label className="settings-label" htmlFor="formConfirmPassword">Confirm New Password</label>
        <input
          id="formConfirmPassword"
          type="password"
          placeholder="Confirm your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="settings-input"
        />
      </div>

      {message && <div className="settings-alert settings-alert-success">{message}</div>}

      <div>
        <button type="submit" className="settings-btn settings-btn-primary">
          Update Account
        </button>
      </div>

      <hr className="settings-divider" />

      <div className="settings-danger-zone">
        <h5 className="settings-danger-title">
          <Warning size={16} weight="fill" />
          Danger Zone
        </h5>
        <p className="settings-danger-desc">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="settings-btn settings-btn-danger"
        >
          <Trash size={16} />
          Delete Account
        </button>
      </div>

      <DeleteAccountModal
        show={showDeleteModal}
        email={email}
        onClose={() => { setShowDeleteModal(false); setDeleteError(''); }}
        onConfirm={handleDeleteAccount}
        loading={deleting}
        error={deleteError}
      />
    </form>
  );
});

export default AccountSettingsForm;
