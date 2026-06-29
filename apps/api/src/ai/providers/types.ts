export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteOpts {
  messages: ChatTurn[];
  maxTokens: number;
  system?: string;
}

// A provider returns the raw text of the model's reply (JSON, possibly fenced).
export type Complete = (opts: CompleteOpts) => Promise<string>;
