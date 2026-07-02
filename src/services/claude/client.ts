import { getApiKey } from '../storage/secureConfig';
import type { ChecklistStep, ChecklistStepStatus } from '../../types/page';
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
  existingSteps?: ChecklistStep[],
): Promise<{ steps: ChecklistStep[]; answer: string }> {
  const userPrompt = existingSteps
    ? `${CHECKLIST_MODE_USER_PROMPT}\nRe-check this existing checklist. Preserve its step count, order, and text exactly; update only status and hint:\n${JSON.stringify(existingSteps.map(({ text }) => ({ text })))}`
    : CHECKLIST_MODE_USER_PROMPT;

  const text = await callMessagesApi({
    max_tokens: 1024,
    system: CHECKLIST_MODE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: backgroundBase64Png } },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: inkBase64Png } },
          { type: 'text', text: userPrompt },
        ],
      },
    ],
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw new ClaudeApiError('invalid_response', 'Claude returned checklist data in an invalid format.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ClaudeApiError('invalid_response', 'Claude returned checklist data in an invalid format.');
  }

  const candidate = parsed as { steps?: unknown; answer?: unknown };
  if (!Array.isArray(candidate.steps) || candidate.steps.length === 0 || typeof candidate.answer !== 'string') {
    throw new ClaudeApiError('invalid_response', 'Claude returned incomplete checklist data.');
  }
  if (existingSteps && candidate.steps.length !== existingSteps.length) {
    throw new ClaudeApiError('invalid_response', 'Claude changed the checklist structure during re-check.');
  }

  const validStatuses: ChecklistStepStatus[] = ['unchecked', 'correct', 'incorrect'];
  const steps = candidate.steps.map((value, index): ChecklistStep => {
    if (!value || typeof value !== 'object') {
      throw new ClaudeApiError('invalid_response', 'Claude returned an invalid checklist step.');
    }
    const step = value as { text?: unknown; status?: unknown; hint?: unknown };
    if (
      typeof step.text !== 'string' ||
      typeof step.status !== 'string' ||
      !validStatuses.includes(step.status as ChecklistStepStatus)
    ) {
      throw new ClaudeApiError('invalid_response', 'Claude returned an invalid checklist step.');
    }

    const status = step.status as ChecklistStepStatus;
    return {
      text: existingSteps?.[index].text ?? step.text.trim(),
      status,
      ...(status === 'incorrect' && typeof step.hint === 'string' && step.hint.trim()
        ? { hint: step.hint.trim() }
        : {}),
    };
  });

  return { steps, answer: candidate.answer.trim() };
}
