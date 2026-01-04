import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Search,
  Globe,
  Loader,
  Clock,
  Mic,
  Square
} from 'lucide-react';
import type { WebSearchOptions } from '../../types/search';
import { transcribeAudio } from '../../utils/api';

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

type RecordingState = 'idle' | 'recording' | 'processing';

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
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        await transcribeRecording();
      };
      
      mediaRecorder.start();
      setRecordingState('recording');
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const transcribeRecording = async () => {
    setRecordingState('processing');
    
    try {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const text = await transcribeAudio(audioBlob);
      setInput(input + (input ? ' ' : '') + text);
    } catch (err) {
      console.error('Transcription error:', err);
      alert('Transcription failed. Please try again.');
    } finally {
      setRecordingState('idle');
      setRecordingTime(0);
    }
  };

  const toggleRecording = () => {
    if (recordingState === 'idle') {
      startRecording();
    } else if (recordingState === 'recording') {
      stopRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="chat-input-wrapper">
      {recordingState !== 'idle' && (
        <div className="recording-indicator">
          <div className="recording-pulse"></div>
          <span className="recording-text">
            {recordingState === 'processing' ? 'Transcribing...' : `Recording ${formatTime(recordingTime)}`}
          </span>
        </div>
      )}
      
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
        <div className={`modern-input-box ${searchOptions.search_web ? 'search-mode' : ''} ${recordingState === 'recording' ? 'recording-active' : ''}`}>
          <div className="input-prefix">
            <button
              className={`action-icon-btn ${searchOptions.search_web ? 'active' : ''}`}
              onClick={handleWebSearchToggle}
              title="Toggle web search"
              type="button"
            >
              {searchOptions.search_web ? <Globe size={18} /> : <Search size={18} />}
            </button>
            <button
              className={`action-icon-btn mic-btn ${recordingState === 'recording' ? 'recording' : ''}`}
              onClick={toggleRecording}
              title={recordingState === 'idle' ? 'Start recording' : 'Stop recording'}
              type="button"
              disabled={recordingState === 'processing'}
            >
              {recordingState === 'recording' ? (
                <Square size={18} />
              ) : (
                <Mic size={18} />
              )}
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
              setShowSuggestions(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder={recordingState === 'processing' ? 'Transcribing...' : 'Ask anything...'}
            disabled={recordingState === 'processing'}
          />

          <div className="input-suffix">
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim() || recordingState === 'processing'}
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
