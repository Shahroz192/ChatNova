import { useState, useRef, useCallback } from "react";
import { streamChat } from "../utils/api/chat";
import type { Message } from "../types/chat";
import type { WebSearchOptions } from "../types/search";
import { useToast } from "../contexts/ToastContext";

export const useChatStreaming = (
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  currentSessionId: number | null,
  selectedModel: string,
  searchOptions: WebSearchOptions,
  useTools: boolean,
  createSession: () => Promise<number>,
  fetchSessions: () => Promise<void>,
) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(
    null,
  );
  const [streamingResponse, setStreamingResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingAbortController, setStreamingAbortController] =
    useState<AbortController | null>(null);

  const streamingResponseRef = useRef("");
  const { error: showError, success: showSuccess } = useToast();

  const resetStreamingState = useCallback(() => {
    setIsStreaming(false);
    setStreamingMessageId(null);
    setStreamingResponse("");
    setStreamingAbortController(null);
    streamingResponseRef.current = "";
  }, []);

  const cancelStreaming = useCallback(() => {
    if (streamingAbortController) {
      streamingAbortController.abort();
    }
    resetStreamingState();
  }, [streamingAbortController, resetStreamingState]);

  const handleStreamChunk = useCallback((chunk: string) => {
    streamingResponseRef.current += chunk;
    setStreamingResponse(streamingResponseRef.current);
  }, []);

  const applyToolUpdate = useCallback(
    (messageId: number, toolUpdate: any) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          const tools = msg.tool_calls ? [...msg.tool_calls] : [];

          if (toolUpdate.type === "tool_start") {
            tools.push({
              tool: toolUpdate.tool,
              input: toolUpdate.input,
              status: "running",
              id: toolUpdate.tool_call_id,
            });
          } else if (toolUpdate.type === "tool_end") {
            const toolIdx = toolUpdate.tool_call_id
              ? tools.findIndex((t) => t.id === toolUpdate.tool_call_id)
              : tools.map((t) => t.status).lastIndexOf("running");

            if (toolIdx !== -1) {
              tools[toolIdx] = {
                ...tools[toolIdx],
                output: toolUpdate.output,
                status: "completed",
              };
            }
          }

          return {
            ...msg,
            tool_calls: tools,
          };
        }),
      );
    },
    [setMessages],
  );

  const sendMessage = useCallback(
    async (
      messageContent: string,
      images?: string[],
      pendingDocumentIds: number[] = [],
      pendingDocuments: {
        id: number;
        filename: string;
        file_type: string;
      }[] = [],
      clearInput?: () => void,
      sessionIdOverride?: number,
    ) => {
      if (!messageContent.trim() && (!images || images.length === 0)) return;
      if (isStreaming) return;

      setLoading(true);

      try {
        let sessionId = sessionIdOverride ?? currentSessionId;
        if (!sessionId) {
          sessionId = await createSession();
          if (!sessionId) throw new Error("Failed to create session");
        }

        clearInput?.();

        const tempMessage: Message = {
          id: Date.now(),
          content: messageContent,
          response: "",
          created_at: new Date().toISOString(),
          status: "sending",
          images: images,
          documents: pendingDocuments,
        };
        setMessages((prev) => [...prev, tempMessage]);

        setIsStreaming(true);
        setStreamingMessageId(tempMessage.id);
        setStreamingResponse("");
        streamingResponseRef.current = "";

        const controller = new AbortController();
        setStreamingAbortController(controller);

        // Safety timeout: abort the stream if no response within 90s
        const streamTimeout = setTimeout(() => {
          if (!controller.signal.aborted) {
            controller.abort();
            showError("Response timed out. Please try again.");
            resetStreamingState();
          }
        }, 90_000);

        // Clear the timeout when stream completes
        const clearStreamTimeout = () => clearTimeout(streamTimeout);

        // Use a ref to track the real message ID (avoids stale closure issues)
        const activeMsgIdRef = { current: tempMessage.id };

        await streamChat(
          messageContent,
          selectedModel,
          sessionId,
          { ...searchOptions, document_ids: pendingDocumentIds } as any,
          useTools,
          images,
          handleStreamChunk,
          () => {
            clearStreamTimeout();
            const finalResponse = streamingResponseRef.current;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === activeMsgIdRef.current
                  ? { ...msg, response: finalResponse, status: "sent" as const }
                  : msg,
              ),
            );
            resetStreamingState();
            fetchSessions();
          },
          (error) => {
            clearStreamTimeout();
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === activeMsgIdRef.current
                  ? { ...msg, status: "failed" as const }
                  : msg,
              ),
            );
            showError(`Failed to send: ${error}`);
            resetStreamingState();
          },
          (toolUpdate) => applyToolUpdate(activeMsgIdRef.current, toolUpdate),
          () => showSuccess(`Memory saved`),
          (metadata) => {
            if (metadata.message_id) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === activeMsgIdRef.current
                    ? { ...msg, id: metadata.message_id }
                    : msg,
                ),
              );
              activeMsgIdRef.current = metadata.message_id;
              setStreamingMessageId(metadata.message_id);
            }
          },
          (uiData) => {
            // Store validated UI data from structured output on the message
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === activeMsgIdRef.current
                  ? { ...msg, ui_data: uiData }
                  : msg,
              ),
            );
          },
          controller.signal,
        );
        clearStreamTimeout();
      } catch (error) {
        console.error("Failed to send message", error);
        // Don't show error toast if it was a timeout (already handled above)
        if (error instanceof DOMException && error.name === "AbortError") {
          // Timeout already showed its own error, just clean up
        } else {
          showError("Failed to send message");
        }
      } finally {
        setLoading(false);
      }
    },
    [
      isStreaming,
      currentSessionId,
      selectedModel,
      searchOptions,
      useTools,
      createSession,
      handleStreamChunk,
      resetStreamingState,
      fetchSessions,
      showError,
      showSuccess,
      setMessages,
      applyToolUpdate,
    ],
  );

  const regenerateResponse = useCallback(
    async (message: Message) => {
      if (isStreaming) return;
      setLoading(true);

      try {
        let sessionId = currentSessionId;
        if (!sessionId) {
          sessionId = await createSession();
          if (!sessionId) throw new Error("Failed to create session");
        }

        const docIds = message.documents?.map((doc) => doc.id) || [];
        const images = message.images || [];

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== message.id) return msg;
            const versions = msg.response_versions?.length
              ? [...msg.response_versions]
              : msg.response
                ? [
                    {
                      id: msg.id,
                      response: msg.response,
                      created_at: msg.created_at,
                      model: msg.model,
                    },
                  ]
                : [];

            return {
              ...msg,
              response_versions: versions,
              response: "",
              status: "sending" as const,
              tool_calls: [],
            };
          }),
        );

        setIsStreaming(true);
        setStreamingMessageId(message.id);
        setStreamingResponse("");
        streamingResponseRef.current = "";

        const controller = new AbortController();
        setStreamingAbortController(controller);

        const activeMsgIdRef = { current: message.id };

        await streamChat(
          message.content,
          message.model ?? selectedModel,
          sessionId,
          { ...searchOptions, document_ids: docIds } as any,
          useTools,
          images,
          handleStreamChunk,
          () => {
            const finalResponse = streamingResponseRef.current;
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== message.id) return msg;
                const versions = msg.response_versions
                  ? [...msg.response_versions]
                  : [];
                if (
                  !versions.length ||
                  versions[versions.length - 1].response !== finalResponse
                ) {
                  versions.push({
                    id: msg.id,
                    response: finalResponse,
                    created_at: new Date().toISOString(),
                    model: selectedModel,
                  });
                }
                return {
                  ...msg,
                  response: finalResponse,
                  response_versions: versions,
                  status: "sent" as const,
                };
              }),
            );
            resetStreamingState();
          },
          (error) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === message.id
                  ? { ...msg, status: "failed" as const }
                  : msg,
              ),
            );
            showError(
              `Failed to regenerate: ${error}`,
            );
            resetStreamingState();
          },
          (toolUpdate) => applyToolUpdate(message.id, toolUpdate),
          () => showSuccess(`Memory saved`),
          (metadata) => {
            if (metadata.message_id) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === activeMsgIdRef.current
                    ? { ...msg, id: metadata.message_id }
                    : msg,
                ),
              );
              activeMsgIdRef.current = metadata.message_id;
              setStreamingMessageId(metadata.message_id);
            }
          },
          (uiData) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === activeMsgIdRef.current
                  ? { ...msg, ui_data: uiData }
                  : msg,
              ),
            );
          },
          controller.signal,
        );
      } catch (error) {
        console.error("Failed to regenerate response", error);
        showError(
          "Failed to regenerate response",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      isStreaming,
      currentSessionId,
      createSession,
      selectedModel,
      searchOptions,
      useTools,
      handleStreamChunk,
      resetStreamingState,
      showError,
      showSuccess,
      setMessages,
      applyToolUpdate,
    ],
  );

  return {
    isStreaming,
    streamingMessageId,
    streamingResponse,
    loading,
    setLoading,
    sendMessage,
    regenerateResponse,
    cancelStreaming,
  };
};
