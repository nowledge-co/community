import { createHash } from "node:crypto";

export type AcknowledgedCursor = {
  count: number;
  remoteCount: number;
  lastExternalId?: string;
  prefixFingerprint: string;
};

export type AcknowledgedDelta<T> = {
  start: number;
  end: number;
  messages: T[];
  next: AcknowledgedCursor;
  reset: boolean;
};

export function stableMessageFingerprint(message: unknown): string {
  return JSON.stringify(message);
}

function prefixFingerprint<T>(
  messages: readonly T[],
  end: number,
  messageFingerprint: (message: T) => string,
): string {
  const hash = createHash("sha256");
  for (const message of messages.slice(0, end)) {
    const value = messageFingerprint(message);
    hash.update(String(Buffer.byteLength(value)));
    hash.update(":");
    hash.update(value);
  }
  return hash.digest("hex");
}

/** The returned cursor is a candidate; only persistence acknowledgement commits it. */
export function selectAcknowledgedDelta<T>(
  messages: readonly T[],
  cursor: AcknowledgedCursor | undefined,
  externalId: (message: T) => string,
  messageFingerprint: (message: T) => string = stableMessageFingerprint,
): AcknowledgedDelta<T> {
  let start = cursor?.count ?? 0;
  const validCount = Number.isSafeInteger(start) && start >= 0 && start <= messages.length;
  const prefixMatches = validCount && (
    start === 0 || (
      externalId(messages[start - 1]!) === cursor?.lastExternalId &&
      prefixFingerprint(messages, start, messageFingerprint) === cursor?.prefixFingerprint
    )
  );
  const reset = !prefixMatches;
  if (reset) start = 0;
  const end = messages.length;
  return {
    start,
    end,
    messages: messages.slice(start),
    next: {
      count: end,
      remoteCount: cursor?.remoteCount ?? end,
      ...(end > 0 ? { lastExternalId: externalId(messages[end - 1]!) } : {}),
      prefixFingerprint: prefixFingerprint(messages, end, messageFingerprint),
    },
    reset,
  };
}
