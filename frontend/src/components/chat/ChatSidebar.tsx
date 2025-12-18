import React from 'react';
import { Col, Form, Button } from 'react-bootstrap';
import { Settings, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChatSidebarProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  models: string[];
  useTools: boolean;
  setUseTools: (use: boolean) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  setCurrentSessionId: (id: number | null) => void;
  setMessages: (messages: any[]) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  selectedModel,
  setSelectedModel,
  models,
  useTools,
  setUseTools,
  isDropdownOpen,
  setIsDropdownOpen,
  setCurrentSessionId,
  setMessages,
}) => {
  const navigate = useNavigate();

  return (
    <Col
      md={3}
      className="sidebar border-end d-flex flex-column p-4 sidebar-fixed"
      style={{ height: '100vh', position: 'sticky', top: 0 }}
    >
      <div className="d-flex align-items-center mb-4">
        <h2 className="h4 font-weight-bold mb-0 chatnova-title">
          ChatNova
        </h2>
      </div>
      <div className="form-group mb-4">
        <label className="form-label">AI Model</label>
        <div className="custom-dropdown">
          <button
            className="dropdown-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            type="button"
          >
            {selectedModel}
            <span className="dropdown-arrow">{isDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {isDropdownOpen && (
            <ul className="dropdown-options">
              {models.map((model) => (
                <li
                  key={model}
                  className="dropdown-option"
                  onClick={() => {
                    setSelectedModel(model);
                    setIsDropdownOpen(false);
                  }}
                >
                  {model}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Form.Check
        type="checkbox"
        id="use-tools-checkbox"
        label="Use Tools"
        checked={useTools}
        onChange={(e) => setUseTools(e.target.checked)}
        className="mb-2"
      />

      <div className="mt-auto d-flex justify-content-center gap-3">
        <Button
          variant="link"
          onClick={async () => {
            // Clear current session and navigate to clean state
            // New session will be created when first message is sent
            setCurrentSessionId(null);
            setMessages([]);
            navigate('/chat', { replace: true });
          }}
          title="New Chat"
          className="p-2 rounded-circle"
        >
          <Plus size={20} />
        </Button>
        <Button
          variant="link"
          onClick={() => navigate('/settings')}
          title="Settings"
          className="p-2 rounded-circle"
        >
          <Settings size={20} />
        </Button>
      </div>
    </Col>
  );
};

export default ChatSidebar;
