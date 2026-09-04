import { BadRequestException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import {
  ENCRYPTION_ERROR_CODES,
  EncryptionError,
} from '../../../../common/encryption/encryption.errors';
import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { TenantEncryptionKeyRepository } from '../../infrastructure/tenant-encryption-key.repository';
import { TenantPiiRotationRepository } from '../../infrastructure/tenant-pii-rotation.repository';
import { TenantKeyService } from '../../tenant-key.service';
import { TenantPiiCipherService } from '../../tenant-pii-cipher.service';
import { RotateTenantDekCommand } from '../impl/rotate-tenant-dek.command';

type RotateTenantDekResult = {
  readonly tenantId: string;
  readonly previousVersion: number;
  readonly activeVersion: number;
  readonly recordsUpdated: number;
};

@CommandHandler(RotateTenantDekCommand)
export class RotateTenantDekHandler implements ICommandHandler<
  RotateTenantDekCommand,
  ApiSuccessResponse<RotateTenantDekResult>
> {
  constructor(
    private readonly keyRepository: TenantEncryptionKeyRepository,
    private readonly piiRepository: TenantPiiRotationRepository,
    private readonly keyService: TenantKeyService,
    private readonly piiCipherService: TenantPiiCipherService,
  ) {}

  async execute(
    command: RotateTenantDekCommand,
  ): Promise<ApiSuccessResponse<RotateTenantDekResult>> {
    if (!Number.isInteger(command.batchSize) || command.batchSize <= 0) {
      throw new BadRequestException(
        apiError({
          code: ENCRYPTION_ERROR_CODES.invalidPayload,
          message: 'Rotation batch size must be a positive integer.',
        }),
      );
    }

    const versions = await this.startOrResumeRotation(command.tenantId);
    let recordsUpdated = 0;

    while (true) {
      const records = await this.piiRepository.findNextBatch(
        command.tenantId,
        versions.previousVersion,
        command.batchSize,
      );

      if (!records.length) {
        break;
      }

      const rotated = await Promise.all(
        records.map(async (record) => {
          const value = await this.piiCipherService.decryptJson({
            tenantId: command.tenantId,
            purpose: record.purpose,
            recordId: record.id,
            encrypted: record,
          });
          const encrypted =
            await this.piiCipherService.encryptJsonWithKeyVersion({
              tenantId: command.tenantId,
              purpose: record.purpose,
              recordId: record.id,
              keyVersion: versions.activeVersion,
              value,
            });

          if (encrypted.keyVersion !== versions.activeVersion) {
            throw this.invalidStateError();
          }

          return { source: record, encrypted };
        }),
      );

      recordsUpdated += await this.piiRepository.updateBatch(
        command.tenantId,
        versions.previousVersion,
        rotated,
      );
    }

    if (
      (await this.piiRepository.countReferences(
        command.tenantId,
        versions.previousVersion,
      )) !== 0
    ) {
      throw this.invalidStateError();
    }

    await this.keyRepository.finishRotation(
      command.tenantId,
      versions.previousVersion,
    );
    this.keyService.invalidate(command.tenantId, versions.previousVersion);

    return apiSuccess({
      tenantId: command.tenantId,
      previousVersion: versions.previousVersion,
      activeVersion: versions.activeVersion,
      recordsUpdated,
    });
  }

  private async startOrResumeRotation(tenantId: string): Promise<{
    readonly previousVersion: number;
    readonly activeVersion: number;
  }> {
    const [decryptOnly, active] = await Promise.all([
      this.keyRepository.findDecryptOnly(tenantId),
      this.keyRepository.findActive(tenantId),
    ]);

    if (!active) {
      throw this.invalidStateError();
    }

    if (decryptOnly) {
      return {
        previousVersion: decryptOnly.version,
        activeVersion: active.version,
      };
    }

    const nextVersion = await this.keyRepository.getNextVersion(tenantId);
    const nextKey = await this.keyService.prepareKey(tenantId, nextVersion);
    await this.keyRepository.startRotation({
      currentVersion: active.version,
      nextKey,
    });

    return {
      previousVersion: active.version,
      activeVersion: nextVersion,
    };
  }

  private invalidStateError(): EncryptionError {
    return new EncryptionError(
      ENCRYPTION_ERROR_CODES.tenantKeyStateInvalid,
      'Tenant encryption key rotation state is invalid.',
    );
  }
}
