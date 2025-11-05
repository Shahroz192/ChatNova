import React from 'react';
import { Form, Button } from 'react-bootstrap';
import { Send } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  sendMessage: () => void;
  loading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  handleKeyPress,
  sendMessage,
  loading,
}) => {
  return (
    <div className="d-flex gap-3">
      <Form.Control
        as="textarea"
        rows={2}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type your message..."
        className="input-field"
        style={{
          resize: "none",
          flex: 1,
          minHeight: "56px",
          padding: "12px"
        }}
      />
      <Button
        onClick={sendMessage}
        disabled={loading || !input.trim()}
        variant="secondary"
        className="send-button rounded-circle d-flex align-items-center justify-content-center"
        style={{
          width: "56px",
          height: "56px",
          alignSelf: "center",
          backgroundColor: "#000000 !important",
          color: "#ffffff !important"
        }}
      >
        {loading ? (
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        ) : (
          <Send size={20} />
        )}
      </Button>
    </div>
  );
};

export default ChatInput;
