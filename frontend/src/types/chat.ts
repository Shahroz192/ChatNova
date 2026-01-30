export interface ToolCall {
  tool: string;
  input: string;
  output?: string;
  status: 'running' | 'completed' | 'failed';
}

export interface Message {
  id: number;
  content: string;
  response: string;
  created_at: string;
  status?: 'sending' | 'sent' | 'delivered' | 'failed';
  tool_calls?: ToolCall[];
  sources?: { id: number; filename: string }[];
  images?: string[];
}
