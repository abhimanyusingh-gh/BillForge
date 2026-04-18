export interface InviteEmailPayload {
  from: string;
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
}

export interface InviteEmailSenderBoundary {
  send(payload: InviteEmailPayload): Promise<void>;
}
