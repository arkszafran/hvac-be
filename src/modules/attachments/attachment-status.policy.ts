import { AttachmentScanStatus } from '@generated/prisma/enums';

const ALLOWED_NEXT_STATUSES: Readonly<
  Record<AttachmentScanStatus, readonly AttachmentScanStatus[]>
> = {
  [AttachmentScanStatus.pending_upload]: [
    AttachmentScanStatus.scanning,
    AttachmentScanStatus.clean,
    AttachmentScanStatus.quarantined,
  ],
  [AttachmentScanStatus.scanning]: [
    AttachmentScanStatus.clean,
    AttachmentScanStatus.quarantined,
  ],
  [AttachmentScanStatus.clean]: [AttachmentScanStatus.quarantined],
  [AttachmentScanStatus.quarantined]: [],
  [AttachmentScanStatus.scan_failed]: [
    AttachmentScanStatus.clean,
    AttachmentScanStatus.quarantined,
  ],
  [AttachmentScanStatus.upload_expired]: [
    AttachmentScanStatus.scanning,
    AttachmentScanStatus.clean,
    AttachmentScanStatus.quarantined,
  ],
};

export function canTransitionAttachmentStatus(
  current: AttachmentScanStatus,
  next: AttachmentScanStatus,
): boolean {
  return current === next || ALLOWED_NEXT_STATUSES[current].includes(next);
}
