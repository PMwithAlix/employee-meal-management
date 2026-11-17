export type BaleApiFailureKind = 'transient' | 'permanent_user' | 'invalid_token';

export class BaleApiError extends Error {
  readonly retryable: boolean;
  readonly kind: BaleApiFailureKind;
  readonly errorCode: number | null;

  constructor(
    message: string,
    options: {
      retryable: boolean;
      kind?: BaleApiFailureKind;
      errorCode?: number | null;
    },
  ) {
    super(message);
    this.name = 'BaleApiError';
    this.retryable = options.retryable;
    this.kind = options.kind ?? (options.retryable ? 'transient' : 'permanent_user');
    this.errorCode = options.errorCode ?? null;
  }
}

const USER_BOUND_METHODS = new Set(['sendMessage', 'answerCallbackQuery']);

export function isPermanentBaleFailure(error: unknown) {
  return error instanceof BaleApiError && error.kind === 'permanent_user';
}

export function isInvalidBaleTokenFailure(error: unknown) {
  return error instanceof BaleApiError && error.kind === 'invalid_token';
}

function matches(description: string, pattern: RegExp) {
  return pattern.test(description);
}

function isBlockedDestination(description: string) {
  return (
    matches(description, /blocked by the user/i) ||
    matches(description, /kicked from (the )?(group |supergroup |channel )?chat/i) ||
    matches(description, /user is deactivated/i) ||
    matches(description, /bot can't initiate conversation/i)
  );
}

function isMissingDestination(description: string) {
  return (
    matches(description, /chat not found/i) ||
    matches(description, /user not found/i)
  );
}

function isInvalidUpdateInput(description: string) {
  return (
    matches(description, /message text is empty/i) ||
    matches(description, /chat_id is empty/i) ||
    matches(description, /invalid chat_id/i) ||
    matches(description, /query is too old/i) ||
    matches(description, /query_id is invalid/i)
  );
}

/**
 * Uses Bale Bot API `error_code` plus `description` (docs.bale.ai).
 * Unknown 4xx descriptions stay retryable so a global bot failure is not
 * acknowledged as a per-user dead letter.
 */
export function classifyBaleApiFailure(
  errorCode: number | null,
  httpStatus: number | null,
  description = '',
  method?: string,
): { retryable: boolean; kind: BaleApiFailureKind } {
  const code = errorCode ?? (httpStatus && httpStatus >= 400 ? httpStatus : null);
  const text = description.trim();
  const userBound = !method || USER_BOUND_METHODS.has(method);

  if (code === 401) {
    return { retryable: true, kind: 'invalid_token' };
  }
  if (code === 429 || (code !== null && code >= 500) || code === null) {
    return { retryable: true, kind: 'transient' };
  }

  if (userBound && code === 403 && isBlockedDestination(text)) {
    return { retryable: false, kind: 'permanent_user' };
  }
  if (userBound && code === 404 && isMissingDestination(text)) {
    return { retryable: false, kind: 'permanent_user' };
  }
  if (userBound && code === 400 && (isInvalidUpdateInput(text) || isMissingDestination(text))) {
    return { retryable: false, kind: 'permanent_user' };
  }

  return { retryable: true, kind: 'transient' };
}

export function redactBaleLogText(value: string) {
  return value.replace(/\d+:[A-Za-z0-9_-]+/g, '[redacted]');
}
