import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { apiError } from '../../common/types/api-response.type';
import {
  ATTACHMENT_EXTENSION_BY_CONTENT_TYPE,
  ATTACHMENTS_ALLOWED_CONTENT_TYPES,
  ATTACHMENTS_ERROR_CODES,
  type AttachmentAllowedContentType,
} from './attachments.constants';
import type {
  AttachmentUploadFile,
  AttachmentUploadForm,
  PreparedPendingAttachment,
  UploadableAttachment,
} from './attachments.types';
import { GcsAttachmentsStorageService } from './infrastructure/gcs-attachments-storage.service';

@Injectable()
export class AttachmentUploadService {
  private readonly maxFileSizeBytes: number;
  private readonly maxFilesPerRequest: number;
  private readonly uploadExpiresSeconds: number;

  constructor(
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

  preparePendingAttachments(input: {
    readonly tenantId: string;
    readonly files: readonly AttachmentUploadFile[];
  }): PreparedPendingAttachment[] {
    this.validateFiles(input.files);

    const uploadExpiresAt = new Date(
      Date.now() + this.uploadExpiresSeconds * 1000,
    );

    return input.files.map((file) => {
      const contentType = file.contentType as AttachmentAllowedContentType;
      const extension = ATTACHMENT_EXTENSION_BY_CONTENT_TYPE[contentType];

      return {
        ...file,
        tenantId: input.tenantId,
        fileName: file.fileName.trim(),
        contentType,
        objectKey: `tenants/${input.tenantId}/attachments/${file.id}${extension}`,
        uploadExpiresAt,
        description: file.description?.trim() || null,
      };
    });
  }

  async createUploadForms(
    attachments: readonly UploadableAttachment[],
  ): Promise<AttachmentUploadForm[]> {
    return Promise.all(
      attachments.map(async (attachment) => {
        const policy = await this.storage.createUploadPolicy({
          objectKey: attachment.objectKey,
          contentType: attachment.contentType,
          maxSizeBytes: this.maxFileSizeBytes,
          expiresAt: attachment.uploadExpiresAt,
        });

        return { method: 'POST' as const, ...policy };
      }),
    );
  }

  isMatchingUploadedFile(input: {
    readonly expectedContentType: string;
    readonly expectedSizeBytes: number;
    readonly actualContentType: string;
    readonly actualSizeBytes: number;
  }): boolean {
    return (
      Number.isSafeInteger(input.actualSizeBytes) &&
      input.actualSizeBytes >= 1 &&
      input.actualSizeBytes === input.expectedSizeBytes &&
      input.actualSizeBytes <= this.maxFileSizeBytes &&
      input.actualContentType === input.expectedContentType &&
      ATTACHMENTS_ALLOWED_CONTENT_TYPES.includes(
        input.actualContentType as AttachmentAllowedContentType,
      )
    );
  }

  private validateFiles(files: readonly AttachmentUploadFile[]): void {
    if (files.length > this.maxFilesPerRequest) {
      throwInvalidUploadRequest(
        `At most ${this.maxFilesPerRequest} files can be prepared at once.`,
      );
    }

    for (const file of files) {
      const fileName = file.fileName.trim();

      if (!fileName || fileName.length > 255) {
        throwInvalidUploadRequest('File name is invalid.');
      }

      if (containsUnsafeFileNameCharacters(fileName)) {
        throwInvalidUploadRequest('File name contains unsupported characters.');
      }

      if (file.description && file.description.trim().length > 1000) {
        throwInvalidUploadRequest('File description is too long.');
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

      if (
        !Number.isSafeInteger(file.sizeBytes) ||
        file.sizeBytes < 1 ||
        file.sizeBytes > this.maxFileSizeBytes
      ) {
        throwInvalidUploadRequest(
          `File ${file.fileName} exceeds the allowed size.`,
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
