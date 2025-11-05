export interface Message {
  id: number;
  content: string;
  response: string;
  created_at: string;
  status?: 'sending' | 'sent' | 'delivered' | 'failed';
}
