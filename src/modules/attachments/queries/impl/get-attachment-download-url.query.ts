export class GetAttachmentDownloadUrlQuery {
  constructor(
    public readonly tenantId: string,
    public readonly attachmentId: string,
  ) {}
}
