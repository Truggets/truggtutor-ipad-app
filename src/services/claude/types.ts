export type AnthropicImageBlock = {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg';
    data: string;
  };
};

export type AnthropicTextBlock = {
  type: 'text';
  text: string;
};

export type AnthropicContentBlock = AnthropicImageBlock | AnthropicTextBlock;

export type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: AnthropicContentBlock[];
};

export type AnthropicMessagesRequest = {
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
};

export type AnthropicMessagesResponse = {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicTextBlock[];
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'refusal' | null;
};

export type AnthropicErrorResponse = {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
};

export class ClaudeApiError extends Error {
  kind: 'no_api_key' | 'network' | 'api_error' | 'empty_response';

  constructor(kind: ClaudeApiError['kind'], message: string) {
    super(message);
    this.kind = kind;
    this.name = 'ClaudeApiError';
  }
}
