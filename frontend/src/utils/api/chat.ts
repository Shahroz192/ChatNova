import type { WebSearchOptions } from "../../types/search";
import { addToSearchHistory } from "./search";

export const streamChat = async (
  content: string,
  model: string,
  sessionId?: number,
  searchOptions?: WebSearchOptions,
  useTools?: boolean,
  images?: string[],
  onChunk?: (chunk: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void,
  onToolUpdate?: (update: any) => void,
  onMemorySaved?: (fact: string) => void,
  onMetadata?: (metadata: any) => void,
  onUI?: (uiData: any) => void,
  signal?: AbortSignal,
) => {
  try {
    const params = new URLSearchParams();
    if (sessionId) params.append("session_id", sessionId.toString());

    const requestBody: any = { content, model, images };

    if (searchOptions) {
      requestBody.search_web = searchOptions.search_web;
      if (searchOptions.search_type) requestBody.search_type = searchOptions.search_type;
      if (searchOptions.max_results) requestBody.max_results = searchOptions.max_results;
      if (searchOptions.language) requestBody.language = searchOptions.language;
      if (searchOptions.region) requestBody.region = searchOptions.region;
      if (searchOptions.modifiers) requestBody.search_modifiers = searchOptions.modifiers;
      if (searchOptions.document_ids) requestBody.document_ids = searchOptions.document_ids;
    }

    const endpoint = useTools ? "/api/v1/chat/agent-stream" : "/api/v1/chat/stream";

    const response = await fetch(`${endpoint}?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body reader available");

    const decoder = new TextDecoder();
    let buffer = "";
    let hasSearchData = false;
    let currentEventData = "";
    let streamCompleted = false;
    let streamFailed = false;

    const processEvent = (dataRaw: string) => {
      const dataTrimmed = dataRaw.trim();
      let parsedData: any = null;
      try { parsedData = JSON.parse(dataTrimmed); } catch { /* string content */ }

      if (dataTrimmed === "[DONE]") {
        if (hasSearchData && searchOptions?.search_web) {
          addToSearchHistory(content, searchOptions.search_type || "general");
        }
        streamCompleted = true;
        onComplete?.();
        return "done";
      }

      if (dataTrimmed.startsWith("ERROR:")) {
        streamFailed = true;
        onError?.(dataTrimmed.slice(6));
        return "error";
      }

      if (parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)) {
        if (parsedData.type === "tool_start" || parsedData.type === "tool_end") {
          onToolUpdate?.(parsedData);
        } else if (parsedData.type === "content") {
          onChunk?.(parsedData.content);
        } else if (parsedData.type === "metadata") {
          onMetadata?.(parsedData);
        } else if (parsedData.type === "memory_saved") {
          onMemorySaved?.(parsedData.content);
        } else if (parsedData.type === "error") {
          streamFailed = true;
          onError?.(parsedData.content);
          return "error";
        } else if (parsedData.type === "ui") {
          onUI?.(parsedData.data);
        } else if (parsedData.type === "container" && Array.isArray(parsedData.children)) {
          onChunk?.(JSON.stringify(parsedData));
        } else {
          const jsonString = JSON.stringify(parsedData);
          if (jsonString.includes('"type":"container"') && jsonString.includes("search_results")) {
            hasSearchData = true;
            onChunk?.(jsonString);
          }
        }
      } else {
        onChunk?.(dataRaw);
      }
      return "continue";
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].endsWith("\r") ? lines[i].slice(0, -1) : lines[i];

        if (line === "") {
          const nextLine = lines[i + 1]?.endsWith("\r") ? lines[i + 1].slice(0, -1) : lines[i + 1];
          const looksLikeEvent = nextLine === undefined
            || nextLine.startsWith("data:")
            || nextLine.startsWith(":")
            || nextLine.startsWith("id:")
            || nextLine.startsWith("event:")
            || nextLine.startsWith("retry:");

          if (currentEventData !== "" && looksLikeEvent) {
            const status = processEvent(currentEventData);
            currentEventData = "";
            if (status === "done" || status === "error") return;
          } else if (currentEventData !== "") {
            currentEventData += "\n";
          }
          continue;
        }

        if (line.startsWith("data:")) {
          let dataPart = line.slice(5);
          if (dataPart.startsWith(" ")) dataPart = dataPart.slice(1);
          currentEventData += (currentEventData ? "\n" : "") + dataPart;
        } else if (!line.startsWith(":")) {
          currentEventData += (currentEventData ? "\n" : "") + line;
        }
      }
    }

    if (currentEventData !== "") {
      const status = processEvent(currentEventData);
      if (status === "done" || status === "error") return;
    }

    if (!streamCompleted && !streamFailed) {
      onError?.("Response stream ended before completion");
    }
  } catch (error) {
    console.error("Streaming error:", error);
    onError?.(error instanceof Error ? error.message : "Unknown error occurred");
  }
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.wav");
  const response = await fetch("/api/v1/chat/transcribe", {
    method: "POST", body: formData, credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.status} - ${await response.text()}`);
  }
  const data = await response.json();
  return data.text;
};

export const uploadFile = async (file: File, sessionId: number): Promise<any> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`/api/v1/chat/upload?session_id=${sessionId}`, {
    method: "POST", body: formData, credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} - ${await response.text()}`);
  }
  return response.json();
};

export const getDocumentStatus = async (
  documentId: number,
): Promise<{ document_id: number; status: string; filename: string }> => {
  const response = await fetch(`/api/v1/chat/documents/${documentId}/status`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to get document status: ${response.status}`);
  }
  return response.json();
};
