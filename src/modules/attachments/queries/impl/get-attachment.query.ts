export class GetAttachmentQuery {
  constructor(
    public readonly tenantId: string,
    public readonly attachmentId: string,
  ) {}
}
