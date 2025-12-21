import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Search,
  Globe,
  Loader,
  Clock
} from 'lucide-react';
import type { WebSearchOptions } from '../../types/search';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => void;
  loading: boolean;
  searchOptions?: WebSearchOptions;
  onSearchOptionsChange?: (options: WebSearchOptions) => void;
  searchSuggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  recentSearches?: string[];
  onRecentSearchSelect?: (query: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  sendMessage,
  loading,
  searchOptions = { search_web: false },
  onSearchOptionsChange,
  searchSuggestions = [],
  onSuggestionSelect,
  recentSearches = [],
  onRecentSearchSelect
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleWebSearchToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    const newOptions = {
      ...searchOptions,
      search_web: !searchOptions.search_web
    };
    onSearchOptionsChange?.(newOptions);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    onSuggestionSelect?.(suggestion);
  };

  const handleRecentSearchClick = (query: string) => {
    setInput(query);
    onRecentSearchSelect?.(query);
  };

  return (
    <div className="chat-input-wrapper">
      <div className="chat-input-container-modern">
        {/* Suggestions dropdown */}
        {showSuggestions && (searchSuggestions.length > 0 || recentSearches.length > 0) && (
          <div
            ref={suggestionsRef}
            className="search-suggestions-container"
          >
            {/* Search suggestions */}
            {searchSuggestions.length > 0 && (
              <div className="suggestions-group">
                <div className="suggestions-group-label">Suggestions</div>
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="suggestion-row"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <Search size={14} className="icon-muted" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div className="suggestions-group">
                <div className="suggestions-group-label">Recent Searches</div>
                {recentSearches.slice(0, 5).map((query, index) => (
                  <button
                    key={index}
                    className="suggestion-row"
                    onClick={() => handleRecentSearchClick(query)}
                  >
                    <Clock size={14} className="icon-muted" />
                    <span>{query}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Unified Input Area */}
        <div className={`modern-input-box ${searchOptions.search_web ? 'search-mode' : ''}`}>
          <div className="input-prefix">
            <button
              className={`action-icon-btn ${searchOptions.search_web ? 'active' : ''}`}
              onClick={handleWebSearchToggle}
              title="Toggle web search"
              type="button"
            >
              {searchOptions.search_web ? <Globe size={18} /> : <Search size={18} />}
            </button>
          </div>

          <textarea
            ref={textareaRef}
            className="modern-textarea"
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
              if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            onFocus={() => {
              if (input.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder="Ask anything..."
          />

          <div className="input-suffix">
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="send-icon-btn"
              title="Send message"
            >
              {loading ? (
                <Loader size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ChatInput;
