export type SendEmailInput = {
  readonly recipients: string | readonly string[];
  readonly subject: string;
  readonly templateFilePath?: string;
  readonly templateVariables?: Record<string, unknown>;
  readonly template?: string;
};
