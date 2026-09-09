import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';

import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import {
  ATTACHMENT_EXTENSION_BY_CONTENT_TYPE,
  ATTACHMENTS_ALLOWED_CONTENT_TYPES,
  ATTACHMENTS_ERROR_CODES,
  type AttachmentAllowedContentType,
} from '../../attachments.constants';
import { mapAttachmentDto } from '../../attachments.mapper';
import type { PrepareAttachmentUploadsDataDto } from '../../dto/attachment-response.dto';
import { AttachmentsRepository } from '../../infrastructure/attachments.repository';
import { GcsAttachmentsStorageService } from '../../infrastructure/gcs-attachments-storage.service';
import { PrepareAttachmentUploadsCommand } from '../impl/prepare-attachment-uploads.command';

@CommandHandler(PrepareAttachmentUploadsCommand)
export class PrepareAttachmentUploadsHandler implements ICommandHandler<
  PrepareAttachmentUploadsCommand,
  ApiSuccessResponse<PrepareAttachmentUploadsDataDto>
> {
  private readonly maxFileSizeBytes: number;
  private readonly maxFilesPerRequest: number;
  private readonly uploadExpiresSeconds: number;

  constructor(
    private readonly attachmentsRepository: AttachmentsRepository,
    private readonly storage: GcsAttachmentsStorageService,
    configService: ConfigService,
  ) {
    this.maxFileSizeBytes = Number(
      configService.getOrThrow<string | number>(
        'ATTACHMENTS_MAX_FILE_SIZE_BYTES',
      ),
    );
    this.maxFilesPerRequest = Number(
      configService.getOrThrow<string | number>(
        'ATTACHMENTS_MAX_FILES_PER_REQUEST',
      ),
    );
    this.uploadExpiresSeconds = Number(
      configService.getOrThrow<string | number>(
        'ATTACHMENTS_UPLOAD_EXPIRES_SECONDS',
      ),
    );
  }

  async execute(
    command: PrepareAttachmentUploadsCommand,
  ): Promise<ApiSuccessResponse<PrepareAttachmentUploadsDataDto>> {
    this.validateFiles(command);

    const uploadExpiresAt = new Date(
      Date.now() + this.uploadExpiresSeconds * 1000,
    );
    const pending = command.dto.files.map((file) => {
      const contentType = file.contentType as AttachmentAllowedContentType;
      const id = randomUUID();
      const extension = ATTACHMENT_EXTENSION_BY_CONTENT_TYPE[contentType];

      return {
        id,
        tenantId: command.tenantId,
        fileName: file.fileName,
        objectKey: `tenants/${command.tenantId}/attachments/${id}${extension}`,
        contentType,
        sizeBytes: file.sizeBytes,
        uploadExpiresAt,
        description: file.description?.trim() || null,
      };
    });
    const policies = await Promise.all(
      pending.map((attachment) =>
        this.storage.createUploadPolicy({
          objectKey: attachment.objectKey,
          contentType: attachment.contentType,
          maxSizeBytes: this.maxFileSizeBytes,
          expiresAt: attachment.uploadExpiresAt,
        }),
      ),
    );
    const storedAttachments =
      await this.attachmentsRepository.createPendingMany(pending);

    return apiSuccess({
      attachments: storedAttachments.map((attachment, index) => ({
        attachment: mapAttachmentDto(attachment),
        upload: {
          url: policies[index].url,
          fields: policies[index].fields,
          expiresAt: policies[index].expiresAt.toISOString(),
        },
      })),
    });
  }

  private validateFiles(command: PrepareAttachmentUploadsCommand): void {
    if (command.dto.files.length > this.maxFilesPerRequest) {
      throwInvalidUploadRequest(
        `At most ${this.maxFilesPerRequest} files can be prepared at once.`,
      );
    }

    for (const file of command.dto.files) {
      if (containsUnsafeFileNameCharacters(file.fileName)) {
        throwInvalidUploadRequest('File name contains unsupported characters.');
      }

      if (
        !ATTACHMENTS_ALLOWED_CONTENT_TYPES.includes(
          file.contentType as AttachmentAllowedContentType,
        )
      ) {
        throwInvalidUploadRequest(
          `Content type ${file.contentType} is not supported.`,
        );
      }

      if (file.sizeBytes > this.maxFileSizeBytes) {
        throwInvalidUploadRequest(
          `File ${file.fileName} exceeds the ${this.maxFileSizeBytes} byte limit.`,
        );
      }
    }
  }
}

function containsUnsafeFileNameCharacters(fileName: string): boolean {
  return [...fileName].some((character) => {
    const code = character.charCodeAt(0);

    return code < 32 || code === 127;
  });
}

function throwInvalidUploadRequest(message: string): never {
  throw new BadRequestException(
    apiError({
      code: ATTACHMENTS_ERROR_CODES.invalidRequest,
      message,
    }),
  );
}
