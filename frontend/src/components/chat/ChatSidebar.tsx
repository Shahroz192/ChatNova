import React, { useCallback, useState, useEffect } from 'react';
import { GearSix, Plus, Trash, PushPin, PushPinSlash, MagnifyingGlass, List, DotsThreeVertical, Sun, Moon, Monitor, X as XIcon } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { ThemeToggle } from '../common/ThemeToggle';
import api from '../../utils/api';
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
  onToggleExpanded?: (expanded: boolean) => void;
  onOpenSettings?: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  selectedModel: _selectedModel,
  setSelectedModel: _setSelectedModel,
  models: _models,
  useTools: _useTools,
  setUseTools: _setUseTools,
  isDropdownOpen: _isDropdownOpen,
  setIsDropdownOpen: _setIsDropdownOpen,
  onToggleExpanded,
  onOpenSettings,
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
  const { theme, setTheme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [pinnedSessions, setPinnedSessions] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pinnedSessions');
    if (saved) {
      setPinnedSessions(new Set(JSON.parse(saved)));
    }
    // Fetch user email
    api.get('/users/me').then((res) => {
      setUserEmail(res.data.email);
    }).catch(() => {});
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

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    navigate('/chat', { replace: true });
  }, [setCurrentSessionId, setMessages, navigate]);

  const handleSettingsClick = useCallback(() => {
    onOpenSettings?.();
  }, [onOpenSettings]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => {
      const next = !prev;
      onToggleExpanded?.(next);
      return next;
    });
  }, [onToggleExpanded]);

  return (
    <div className={`floating-sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Toggle button */}
      <button
        className="sidebar-toggle"
        onClick={toggleExpanded}
        title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        {isExpanded ? <XIcon size={18} /> : <List size={18} />}
      </button>

      {/* Collapsed state — just icons */}
      {!isExpanded && (
        <div className="sidebar-collapsed-content">
          <button
            className="sidebar-icon-btn"
            onClick={handleNewChat}
            title="New Chat"
          >
            <Plus size={20} weight="bold" />
          </button>

          <div className="sidebar-collapsed-spacer" />

          <div className="sidebar-collapsed-footer">
            <ThemeToggle />
            <button
              onClick={handleSettingsClick}
              title="Settings"
              className="sidebar-icon-btn"
            >
              <GearSix size={20} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded state — full content */}
      {isExpanded && (
        <div className="sidebar-expanded-content">
          {/* Header */}
          <div className="sidebar-expanded-header">
            <h2 className="chatnova-title">ChatNova</h2>
            <button
              className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors new-chat-btn"
              onClick={handleNewChat}
            >
              <Plus size={18} weight="bold" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Search */}
          <div className="sidebar-expanded-search">
            <div className="sidebar-search-container">
              <MagnifyingGlass size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search chats..."
                className="sidebar-search-input"
                value={searchQuery}
                onChange={handleSearchChange}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Sessions */}
          <div className="sidebar-expanded-sessions">
            <div className="session-list">
              {sortedSessions.map((session) => (
                <div
                  key={session.id}
                  className={`session-item ${currentSessionId === session.id ? 'active' : ''} ${pinnedSessions.has(session.id) ? 'pinned' : ''}`}
                  onClick={() => onSessionSelect(session.id)}
                >
                  <span className="session-title text-truncate">
                    {session.title || 'Untitled Chat'}
                  </span>
                  <div className="session-actions flex items-center">
                    <button
                      className={`pin-session-btn ${pinnedSessions.has(session.id) ? 'active' : ''}`}
                      onClick={(e) => togglePin(session.id, e)}
                      title={pinnedSessions.has(session.id) ? "Unpin Chat" : "Pin Chat"}
                    >
                      {pinnedSessions.has(session.id) ? <PushPinSlash size={14} /> : <PushPin size={14} />}
                    </button>
                    <button
                      className="delete-session-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      title="Delete Chat"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && !isLoading && (
                <div className="px-3 py-2 text-gray-500 text-sm italic text-center">
                  {searchQuery ? 'No chats found' : 'No recent chats'}
                </div>
              )}
              {hasMore && (
                <button
                  className="w-full py-2 load-more-btn text-gray-500 text-sm hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50"
                  onClick={onLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load older chats'}
                </button>
              )}
            </div>
          </div>

          {/* Footer — User info + menu */}
          <div className="sidebar-expanded-footer">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-200 shrink-0">
                {userEmail ? userEmail[0].toUpperCase() : '?'}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {userEmail || 'Loading...'}
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="More"
              >
                <DotsThreeVertical size={20} weight="bold" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute bottom-full right-0 mb-2 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-20 overflow-hidden">
                    <button
                      onClick={() => { setShowMenu(false); handleSettingsClick(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <GearSix size={16} />
                      Settings
                    </button>
                    <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Theme</div>
                    <button
                      onClick={() => { setTheme('light'); setShowMenu(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${theme === 'light' ? 'text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      <Sun size={16} />
                      Light
                    </button>
                    <button
                      onClick={() => { setTheme('dark'); setShowMenu(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${theme === 'dark' ? 'text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      <Moon size={16} />
                      Dark
                    </button>
                    <button
                      onClick={() => { setTheme('system'); setShowMenu(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${theme === 'system' ? 'text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                      <Monitor size={16} />
                      System
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ChatSidebar);
