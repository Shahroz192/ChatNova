import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatInput from '../ChatInput';

describe('ChatInput Component', () => {
  it('renders input area', () => {
    const setInput = vi.fn();
    render(
      <ChatInput
        input=""
        setInput={setInput}
        sendMessage={vi.fn()}
        loading={false}
        selectedModel="gemini-2.0-flash"
        onFileUpload={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument();
  });

  it('calls setInput on change', () => {
    const setInput = vi.fn();
    render(
      <ChatInput
        input=""
        setInput={setInput}
        sendMessage={vi.fn()}
        loading={false}
        selectedModel="gemini-2.0-flash"
        onFileUpload={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    expect(setInput).toHaveBeenCalledWith('Hello');
  });

  it('calls sendMessage on send button click', () => {
    const sendMessage = vi.fn();
    render(
      <ChatInput
        input="Hello"
        setInput={vi.fn()}
        sendMessage={sendMessage}
        loading={false}
        selectedModel="gemini-2.0-flash"
        onFileUpload={vi.fn()}
      />
    );

    const sendButton = screen.getByTitle(/Send message/i);
    fireEvent.click(sendButton);

    expect(sendMessage).toHaveBeenCalled();
  });

  it('calls sendMessage on Enter key press', () => {
    const sendMessage = vi.fn();
    render(
      <ChatInput
        input="Hello"
        setInput={vi.fn()}
        sendMessage={sendMessage}
        loading={false}
        selectedModel="gemini-2.0-flash"
        onFileUpload={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: false });

    expect(sendMessage).toHaveBeenCalled();
  });

  it('does not call sendMessage on Shift+Enter', () => {
    const sendMessage = vi.fn();
    render(
      <ChatInput
        input="Hello"
        setInput={vi.fn()}
        sendMessage={sendMessage}
        loading={false}
        selectedModel="gemini-2.0-flash"
        onFileUpload={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('toggles web search', () => {
    const onSearchOptionsChange = vi.fn();
    render(
      <ChatInput
        input=""
        setInput={vi.fn()}
        sendMessage={vi.fn()}
        loading={false}
        searchOptions={{ search_web: false }}
        onSearchOptionsChange={onSearchOptionsChange}
        selectedModel="gemini-2.0-flash"
        onFileUpload={vi.fn()}
      />
    );

    const searchToggle = screen.getByTitle(/Toggle web search/i);
    fireEvent.click(searchToggle);

    expect(onSearchOptionsChange).toHaveBeenCalledWith({ search_web: true });
  });

  it('shows loading spinner when loading is true', () => {
    render(
      <ChatInput
        input="Hello"
        setInput={vi.fn()}
        sendMessage={vi.fn()}
        loading={true}
        selectedModel="gemini-2.0-flash"
        onFileUpload={vi.fn()}
      />
    );

    // The Send icon should be replaced by Loader icon
    // Loader has a class animate-spin
    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();
    
    const sendButton = screen.getByTitle(/Send message/i);
    expect(sendButton).toBeDisabled();
  });
});
