import React, { useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import { Settings, Plus, MessageSquare, Trash2, Pin, PinOff, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../common/ThemeToggle';
import '../../styles/ChatSidebar.css';

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
  sessions: any[];
  currentSessionId: number | null;
  onSessionSelect: (sessionId: number) => void;
  onDeleteSession: (sessionId: number) => void;
  onSearch: (query: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
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
  sessions,
  currentSessionId,
  onSessionSelect,
  onDeleteSession,
  onSearch,
  onLoadMore,
  hasMore,
  isLoading,
}) => {
  const navigate = useNavigate();
  const [pinnedSessions, setPinnedSessions] = React.useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const saved = localStorage.getItem('pinnedSessions');
    if (saved) {
      setPinnedSessions(new Set(JSON.parse(saved)));
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(query);
    }, 300);
  };

  const togglePin = useCallback((sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedSessions(prev => {
      const newPinned = new Set(prev);
      if (newPinned.has(sessionId)) {
        newPinned.delete(sessionId);
      } else {
        newPinned.add(sessionId);
      }
      localStorage.setItem('pinnedSessions', JSON.stringify(Array.from(newPinned)));
      return newPinned;
    });
  }, []);

  const sortedSessions = React.useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aPinned = pinnedSessions.has(a.id);
      const bPinned = pinnedSessions.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [sessions, pinnedSessions]);

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

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    navigate('/chat', { replace: true });
  }, [setCurrentSessionId, setMessages, navigate]);

  const handleSettingsClick = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  return (
    <div className="sidebar d-flex flex-column">
      <div className="sidebar-header px-3 pt-5 pb-4">
        <h2 className="h4 font-weight-bold mb-4 chatnova-title">
          ChatNova
        </h2>
        <Button
          variant="outline-primary"
          className="w-100 d-flex align-items-center justify-content-center gap-2 py-2 new-chat-btn"
          onClick={handleNewChat}
        >
          <Plus size={18} />
          <span>New Chat</span>
        </Button>
      </div>

      <div className="sidebar-content flex-grow-1 overflow-auto">
        <div className="px-3 mb-4">
          <div className="sidebar-search-container">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search chats..."
              className="sidebar-search-input"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        <div className="history-section">
          <label className="section-label px-3 mb-2">Recent Chats</label>
          <div className="session-list">
            {sortedSessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${currentSessionId === session.id ? 'active' : ''} ${pinnedSessions.has(session.id) ? 'pinned' : ''}`}
                onClick={() => onSessionSelect(session.id)}
              >
                <MessageSquare size={16} className="session-icon" />
                <span className="session-title text-truncate">
                  {session.title || 'Untitled Chat'}
                </span>
                <div className="session-actions d-flex align-items-center">
                  <button
                    className={`pin-session-btn ${pinnedSessions.has(session.id) ? 'active' : ''}`}
                    onClick={(e) => togglePin(session.id, e)}
                    title={pinnedSessions.has(session.id) ? "Unpin Chat" : "Pin Chat"}
                  >
                    {pinnedSessions.has(session.id) ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button
                    className="delete-session-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    title="Delete Chat"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {sessions.length === 0 && !isLoading && (
              <div className="px-3 py-2 text-muted small italic text-center">
                {searchQuery ? 'No chats found' : 'No recent chats'}
              </div>
            )}
            {hasMore && (
              <Button
                variant="link"
                className="w-100 py-2 load-more-btn text-muted small"
                onClick={onLoadMore}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Load older chats'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="sidebar-footer px-3 py-2 border-top">
        <div className="d-flex justify-content-between align-items-center">
          <ThemeToggle />
          <Button
            variant="link"
            onClick={handleSettingsClick}
            title="Settings"
            className="p-2 rounded-circle text-muted hover-text-primary d-flex align-items-center justify-content-center"
          >
            <Settings size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChatSidebar);
