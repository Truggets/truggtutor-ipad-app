import { getApiKey } from '../storage/secureConfig';
import { CHECKLIST_MODE_SYSTEM_PROMPT, CHECKLIST_MODE_USER_PROMPT } from './promptTemplates';
import {
  AnthropicErrorResponse,
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  ClaudeApiError,
} from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-5';

async function callMessagesApi(request: Omit<AnthropicMessagesRequest, 'model'>): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new ClaudeApiError('no_api_key', 'No Anthropic API key set. Add one in Settings.');
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, ...request }),
    });
  } catch (err) {
    throw new ClaudeApiError('network', 'Could not reach Claude. Check your internet connection.');
  }

  const json = await response.json();

  if (!response.ok) {
    const errorBody = json as AnthropicErrorResponse;
    throw new ClaudeApiError(
      'api_error',
      errorBody?.error?.message ?? `Claude request failed (${response.status}).`,
    );
  }

  const messageResponse = json as AnthropicMessagesResponse;
  const textBlock = messageResponse.content.find((block) => block.type === 'text');
  if (!textBlock || !textBlock.text.trim()) {
    throw new ClaudeApiError('empty_response', 'Claude returned an empty response.');
  }
  return textBlock.text.trim();
}

export async function getChecklistForRegion(
  backgroundBase64Png: string,
  inkBase64Png: string,
): Promise<string[]> {
  const text = await callMessagesApi({
    max_tokens: 512,
    system: CHECKLIST_MODE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: backgroundBase64Png } },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: inkBase64Png } },
          { type: 'text', text: CHECKLIST_MODE_USER_PROMPT },
        ],
      },
    ],
  });

  return text
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line.length > 0);
}
