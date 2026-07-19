const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Senders we treat as candidate transaction mail. This only narrows the set the
 * AI extractor looks at — the extractor's "not a transaction" null path is the
 * real filter, so this list doesn't have to be exhaustive or perfectly tuned.
 */
export const BANK_SENDERS = [
  'scb.co.th',
  'kasikornbank.com',
  'krungsri.com',
  'bangkokbank.com',
  'ktb.co.th',
  'ttbbank.com',
  'uob.co.th',
  'gsb.or.th',
  'baac.or.th',
  'truemoney.com',
  'kkpfg.com',
];

const FIRST_RUN_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const BOUNDARY_OVERLAP_MS = 24 * 60 * 60 * 1000;

function gmailDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

/**
 * The `q` for an incremental pull. Gmail's `after:` is day-granular, so we start
 * a day before the last sync and let `claimEmail` dedupe the overlap — that
 * closes the same-day gap without ever re-recording a message. A never-synced
 * account (null) starts from a bounded lookback instead of the whole mailbox.
 */
export function buildSyncQuery(lastSyncedAt: string | null): string {
  const since = lastSyncedAt
    ? new Date(new Date(lastSyncedAt).getTime() - BOUNDARY_OVERLAP_MS)
    : new Date(Date.now() - FIRST_RUN_LOOKBACK_MS);

  const senders = BANK_SENDERS.join(' OR ');

  return `from:(${senders}) after:${gmailDate(since)}`;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface RawMessage {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart & { headers?: { name: string; value: string }[] };
}

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  /** Gmail's received timestamp — more reliable than parsing a Date header. */
  receivedAt: Date;
  /** Plain-text body, or the snippet when the message carries no text/plain. */
  text: string;
}

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Gmail API ${path} failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
}

/** Message ids matching the query, newest first, capped so one run stays bounded. */
export async function listMessageIds(
  accessToken: string,
  query: string,
  max = 50,
): Promise<string[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(max) });
  const data = await gmailGet<{ messages?: { id: string }[] }>(
    accessToken,
    `/messages?${params}`,
  );

  return (data.messages ?? []).map((m) => m.id);
}

export async function getMessage(accessToken: string, id: string): Promise<GmailMessage> {
  const raw = await gmailGet<RawMessage>(accessToken, `/messages/${id}?format=full`);

  const headers = raw.payload?.headers ?? [];
  const text = extractPlainText(raw.payload) || raw.snippet || '';

  return {
    id: raw.id,
    subject: getHeader(headers, 'Subject') ?? '',
    from: getHeader(headers, 'From') ?? '',
    receivedAt: raw.internalDate ? new Date(Number(raw.internalDate)) : new Date(),
    text,
  };
}

export function getHeader(
  headers: { name: string; value: string }[],
  name: string,
): string | null {
  const hit = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return hit?.value ?? null;
}

/**
 * Walks a `format=full` payload tree for the first `text/plain` part and decodes
 * it. Bodies are base64url; multipart messages nest the plain part under
 * `parts`, sometimes several levels deep (multipart/alternative inside
 * multipart/mixed), so this recurses rather than reading only the top level.
 */
export function extractPlainText(part: GmailPart | undefined): string {
  if (!part) return '';

  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBody(part.body.data);
  }

  for (const child of part.parts ?? []) {
    const found = extractPlainText(child);
    if (found) return found;
  }

  return '';
}

function decodeBody(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}
