import { AttachmentScanStatus } from '@generated/prisma/enums';

import { canTransitionAttachmentStatus } from './attachment-status.policy';

describe('canTransitionAttachmentStatus', () => {
  it.each([
    [AttachmentScanStatus.pending_upload, AttachmentScanStatus.scanning],
    [AttachmentScanStatus.pending_upload, AttachmentScanStatus.clean],
    [AttachmentScanStatus.scanning, AttachmentScanStatus.clean],
    [AttachmentScanStatus.scanning, AttachmentScanStatus.quarantined],
    [AttachmentScanStatus.clean, AttachmentScanStatus.quarantined],
    [AttachmentScanStatus.scan_failed, AttachmentScanStatus.clean],
    [AttachmentScanStatus.upload_expired, AttachmentScanStatus.scanning],
  ])('allows %s -> %s', (current, next) => {
    expect(canTransitionAttachmentStatus(current, next)).toBe(true);
  });

  it('allows an idempotent duplicate', () => {
    expect(
      canTransitionAttachmentStatus(
        AttachmentScanStatus.clean,
        AttachmentScanStatus.clean,
      ),
    ).toBe(true);
  });

  it.each([
    [AttachmentScanStatus.quarantined, AttachmentScanStatus.clean],
    [AttachmentScanStatus.clean, AttachmentScanStatus.scanning],
    [AttachmentScanStatus.scanning, AttachmentScanStatus.pending_upload],
  ])('rejects %s -> %s', (current, next) => {
    expect(canTransitionAttachmentStatus(current, next)).toBe(false);
  });
});
