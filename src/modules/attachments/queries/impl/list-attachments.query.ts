export class ListAttachmentsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly attachmentIds: readonly string[],
  ) {}
}
