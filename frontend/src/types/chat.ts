export interface ToolCall {
  tool: string;
  input: string;
  output?: string;
  status: 'running' | 'completed' | 'failed';
}

export interface ResponseVersion {
  id: number;
  response: string;
  created_at: string;
  model?: string;
}

export interface Message {
  id: number;
  content: string;
  response: string;
  created_at: string;
  model?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'failed';
  tool_calls?: ToolCall[];
  sources?: { id: number; filename: string }[];
  images?: string[];
  documents?: { id: number; filename: string; file_type: string }[];
  response_versions?: ResponseVersion[];
}
