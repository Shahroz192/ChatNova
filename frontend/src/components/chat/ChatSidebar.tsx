import React, { useCallback } from 'react';
import { Col, Form, Button } from 'react-bootstrap';
import { Settings, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../common/ThemeToggle';

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

  const handleDropdownToggle = useCallback(() => {
    setIsDropdownOpen(!isDropdownOpen);
  }, [isDropdownOpen, setIsDropdownOpen]);

  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model);
    setIsDropdownOpen(false);
  }, [setSelectedModel, setIsDropdownOpen]);

  const handleToolsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUseTools(e.target.checked);
  }, [setUseTools]);

  const handleNewChat = useCallback(async () => {
    // Clear current session and navigate to clean state
    // New session will be created when first message is sent
    setCurrentSessionId(null);
    setMessages([]);
    navigate('/chat', { replace: true });
  }, [setCurrentSessionId, setMessages, navigate]);

  const handleSettingsClick = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  return (
    <Col
      md={3}
      className="sidebar d-flex flex-column p-4"
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
            onClick={handleDropdownToggle}
            type="button"
          >
            {selectedModel}
            <span className="dropdown-arrow">{isDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {isDropdownOpen ? (
            <ul className="dropdown-options">
              {models.map((model) => (
                <li
                  key={model}
                  className="dropdown-option"
                  onClick={() => handleModelSelect(model)}
                >
                  {model}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {models.length === 0 ? (
          <div className="mt-2 text-danger small">
             No models available. Please add API keys in <span 
               className="text-primary text-decoration-underline cursor-pointer" 
               onClick={handleSettingsClick}
               style={{cursor: 'pointer'}}
             >Settings</span>.
          </div>
        ) : null}
      </div>
      <Form.Check
        type="checkbox"
        id="use-tools-checkbox"
        label="Use Tools"
        checked={useTools}
        onChange={handleToolsChange}
        className="mb-2"
      />

      <div className="mt-auto d-flex justify-content-center gap-3 align-items-center">
        <ThemeToggle className="p-2" />
        <Button
          variant="link"
          onClick={handleNewChat}
          title="New Chat"
          className="p-2 rounded-circle"
        >
          <Plus size={20} />
        </Button>
        <Button
          variant="link"
          onClick={handleSettingsClick}
          title="Settings"
          className="p-2 rounded-circle"
        >
          <Settings size={20} />
        </Button>
      </div>
    </Col>
  );
};

export default React.memo(ChatSidebar);
