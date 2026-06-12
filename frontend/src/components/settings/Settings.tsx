import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Nav, Card, Button, Form, Modal } from 'react-bootstrap';
import { Key, Server, User, Sparkles, Brain, AlertTriangle } from 'lucide-react';
import BYOKForm from './BYOKForm';
import MCPServerForm from './MCPServerForm';
import MCPServerList from './MCPServerList';
import PersonalizationForm from './PersonalizationForm';
import MemoryManagement from './MemoryManagement';
import api from '../../utils/api';
import '../../styles/Settings.css';
import '../../styles/MCPServer.css';

interface User {
  id: number;
  email: string;
  messages_used: number;
  created_at?: string;
}

interface SettingsProps {}

const Settings: React.FC<SettingsProps> = () => {
  const [activeTab, setActiveTab] = useState<'keys' | 'personalization' | 'memory' | 'servers' | 'account' | 'privacy' | 'appearance'>('keys');

  const handleTabChange = useCallback((tab: 'keys' | 'personalization' | 'memory' | 'servers' | 'account' | 'privacy' | 'appearance') => {
    setActiveTab(tab);
  }, []);

  return (
    <div className="settings-page">
      <Container fluid className="vh-100 d-flex flex-column">
        <Row className="flex-grow-1">
          <Col md={3} className="bg-light border-end d-flex flex-column p-4 sidebar-fixed" style={{ height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}>
            <div className="mb-4">
              <h2 className="h4 font-weight-bold text-primary mb-2">Settings</h2>
              <p className="text-muted small mb-0">Manage your preferences and configurations</p>
            </div>
            <Nav className="flex-column" variant="pills">
              <Nav.Item className="mb-2">
                <Nav.Link
                  eventKey="keys"
                  active={activeTab === 'keys'}
                  onClick={() => handleTabChange('keys')}
                  className="d-flex align-items-center py-2 px-3 rounded-lg"
                  style={{ transition: 'all 0.2s ease' }}
                >
                  <Key size={18} className="mr-2" />
                  <span className="font-weight-medium">API Keys</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item className="mb-2">
                <Nav.Link
                  eventKey="personalization"
                  active={activeTab === 'personalization'}
                  onClick={() => handleTabChange('personalization')}
                  className="d-flex align-items-center py-2 px-3 rounded-lg"
                  style={{ transition: 'all 0.2s ease' }}
                >
                  <Sparkles size={18} className="mr-2" />
                  <span className="font-weight-medium">Personalization</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item className="mb-2">
                <Nav.Link
                  eventKey="memory"
                  active={activeTab === 'memory'}
                  onClick={() => handleTabChange('memory')}
                  className="d-flex align-items-center py-2 px-3 rounded-lg"
                  style={{ transition: 'all 0.2s ease' }}
                >
                  <Brain size={18} className="mr-2" />
                  <span className="font-weight-medium">Manage Memory</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item className="mb-2">
                <Nav.Link
                  eventKey="servers"
                  active={activeTab === 'servers'}
                  onClick={() => handleTabChange('servers')}
                  className="d-flex align-items-center py-2 px-3 rounded-lg"
                  style={{ transition: 'all 0.2s ease' }}
                >
                  <Server size={18} className="mr-2" />
                  <span className="font-weight-medium">MCP Servers</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item className="mb-2">
                <Nav.Link
                  eventKey="account"
                  active={activeTab === 'account'}
                  onClick={() => handleTabChange('account')}
                  className="d-flex align-items-center py-2 px-3 rounded-lg"
                  style={{ transition: 'all 0.2s ease' }}
                >
                  <User size={18} className="mr-2" />
                  <span className="font-weight-medium">Account</span>
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>

          <Col md={9} className="d-flex flex-column p-4">
            <div className="flex-grow-1">
              
              {activeTab === 'keys' ? (
                <Card>
                  <Card.Header>
                    <Card.Title>API Keys</Card.Title>
                    <Card.Text>
                      Add and manage your API keys for different AI models. Your keys are encrypted and stored securely.
                    </Card.Text>
                  </Card.Header>
                  <Card.Body>
                    <BYOKForm />
                  </Card.Body>
                </Card>
              ) : null}

              {activeTab === 'personalization' ? (
                <Card>
                  <Card.Header>
                    <Card.Title>Custom Instructions</Card.Title>
                    <Card.Text>
                      Customize how the AI responds to you.
                    </Card.Text>
                  </Card.Header>
                  <Card.Body>
                    <PersonalizationForm />
                  </Card.Body>
                </Card>
              ) : null}

              {activeTab === 'memory' ? (
                <Card>
                  <Card.Header>
                    <Card.Title>Long-term Memory</Card.Title>
                    <Card.Text>
                      Facts the AI has learned about you across sessions.
                    </Card.Text>
                  </Card.Header>
                  <Card.Body>
                    <MemoryManagement />
                  </Card.Body>
                </Card>
              ) : null}
              
              {activeTab === 'servers' ? (
                <Card>
                  <Card.Header>
                    <Card.Title>MCP Servers</Card.Title>
                    <Card.Text>
                      Add and manage your MCP (Model Context Protocol) server configurations.
                    </Card.Text>
                  </Card.Header>
                  <Card.Body>
                    <div className="mb-4">
                      <h5 className="mb-3 mcp-server-add-title">Add New MCP Server</h5>
                      <MCPServerForm />
                    </div>
                    
                    <div className="mt-5">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="mcp-server-list-title">Your MCP Servers</h5>
                      </div>
                      <MCPServerList />
                    </div>
                  </Card.Body>
                </Card>
              ) : null}
              
              {activeTab === 'account' ? (
                <Card>
                  <Card.Header>
                    <Card.Title>Account Settings</Card.Title>
                    <Card.Text>
                      Manage your account information and preferences.
                    </Card.Text>
                  </Card.Header>
                  <Card.Body>
                    <AccountSettingsForm />
                  </Card.Body>
                </Card>
              ) : null}
              
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

// Delete Account Confirmation Modal
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

  const isConfirmed = confirmInput === email;

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="text-danger d-flex align-items-center gap-2">
          <AlertTriangle size={20} />
          Delete Account
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted">
          This will permanently delete your account and all associated data —
          including chat history, memories, API keys, and MCP server configurations.
          This action <strong>cannot</strong> be undone.
        </p>
        <Form.Group>
          <Form.Label>
            Type <strong>{email}</strong> to confirm:
          </Form.Label>
          <Form.Control
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={email}
          />
        </Form.Group>
        {error ? <div className="alert alert-danger mt-3">{error}</div> : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={!isConfirmed || loading}
        >
          {loading ? 'Deleting...' : 'Permanently Delete My Account'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Account Settings Form Component
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

  // Fetch current user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/users/me');
        setUser(response.data);
        setName(response.data.email.split('@')[0] || ''); // Use part of email as name
        setEmail(response.data.email);
        setLoading(false);
      } catch (err) {
        setError('Failed to load user data');
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (password && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      // For now, we'll only update email since the backend schema doesn't have a name field
      // In a real implementation, we might need to update the backend to support name updates
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
      
      // If password is provided, we would handle password change separately
      // since it typically requires a different endpoint
      if (password) {
        // Password change would be handled via a separate endpoint
        // For now, we'll show a message that this is not implemented
        setMessage('Password update functionality would be implemented here');
      }
    } catch (err) {
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
    return <div>Loading...</div>;
  }

  return (
    <Form onSubmit={handleSubmit}>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      <Form.Group className="mb-3" controlId="formName">
        <Form.Label>Name</Form.Label>
        <Form.Control
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Form.Group>

      <Form.Group className="mb-3" controlId="formEmail">
        <Form.Label>Email address</Form.Label>
        <Form.Control
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Form.Group>

      <Form.Group className="mb-3" controlId="formPassword">
        <Form.Label>New Password</Form.Label>
        <Form.Control
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Form.Text className="text-muted">
          Leave blank to keep current password
        </Form.Text>
      </Form.Group>

      <Form.Group className="mb-3" controlId="formConfirmPassword">
        <Form.Label>Confirm New Password</Form.Label>
        <Form.Control
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </Form.Group>

      {message ? <div className="alert alert-success">{message}</div> : null}

      <Button variant="primary" type="submit">
        Update Account
      </Button>

      <hr className="my-4" />
      <div className="danger-zone">
        <h5 className="text-danger d-flex align-items-center gap-2 mb-2">
          <AlertTriangle size={18} />
          Danger Zone
        </h5>
        <p className="text-muted small mb-3">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <Button
          variant="outline-danger"
          onClick={() => setShowDeleteModal(true)}
        >
          Delete Account
        </Button>
      </div>

      <DeleteAccountModal
        show={showDeleteModal}
        email={email}
        onClose={() => { setShowDeleteModal(false); setDeleteError(''); }}
        onConfirm={handleDeleteAccount}
        loading={deleting}
        error={deleteError}
      />
    </Form>
  );
});

export default React.memo(Settings);
