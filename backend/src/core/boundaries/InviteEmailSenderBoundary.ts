export interface InviteEmailPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface InviteEmailSenderBoundary {
  send(payload: InviteEmailPayload): Promise<void>;
}
