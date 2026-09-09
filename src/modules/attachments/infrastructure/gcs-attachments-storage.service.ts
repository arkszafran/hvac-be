import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

import type {
  AttachmentDownloadLink,
  AttachmentUploadPolicy,
} from '../attachments.types';

export type CreateAttachmentUploadPolicyInput = {
  readonly objectKey: string;
  readonly contentType: string;
  readonly maxSizeBytes: number;
  readonly expiresAt: Date;
};

export type AttachmentObjectMetadata = {
  readonly contentType: string | null;
  readonly sizeBytes: number | null;
  readonly generation: string | null;
};

@Injectable()
export class GcsAttachmentsStorageService {
  private readonly storage: Storage;
  private readonly unscannedBucket: string;
  private readonly cleanBucket: string;

  constructor(configService: ConfigService) {
    this.storage = new Storage({
      projectId: configService.getOrThrow<string>('ATTACHMENTS_GCP_PROJECT_ID'),
    });
    this.unscannedBucket = configService.getOrThrow<string>(
      'ATTACHMENTS_UNSCANNED_BUCKET',
    );
    this.cleanBucket = configService.getOrThrow<string>(
      'ATTACHMENTS_CLEAN_BUCKET',
    );
  }

  async createUploadPolicy(
    input: CreateAttachmentUploadPolicyInput,
  ): Promise<AttachmentUploadPolicy> {
    const [policy] = await this.storage
      .bucket(this.unscannedBucket)
      .file(input.objectKey)
      .generateSignedPostPolicyV4({
        expires: input.expiresAt,
        fields: {
          'Content-Type': input.contentType,
          success_action_status: '201',
        },
        conditions: [
          ['eq', '$Content-Type', input.contentType],
          ['content-length-range', 1, input.maxSizeBytes],
        ],
      });

    return {
      url: policy.url,
      fields: policy.fields,
      expiresAt: input.expiresAt,
    };
  }

  async getCleanObjectMetadata(
    objectKey: string,
    generation: string,
  ): Promise<AttachmentObjectMetadata> {
    const [metadata] = await this.storage
      .bucket(this.cleanBucket)
      .file(objectKey, { generation })
      .getMetadata();

    return {
      contentType:
        typeof metadata.contentType === 'string' ? metadata.contentType : null,
      sizeBytes: parseOptionalInteger(metadata.size),
      generation:
        typeof metadata.generation === 'string' ? metadata.generation : null,
    };
  }

  async createDownloadUrl(input: {
    readonly objectKey: string;
    readonly fileName: string;
    readonly storageGeneration: string | null;
    readonly expiresAt: Date;
  }): Promise<AttachmentDownloadLink> {
    const file = this.storage.bucket(this.cleanBucket).file(input.objectKey, {
      ...(input.storageGeneration
        ? { generation: input.storageGeneration }
        : {}),
    });
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: input.expiresAt,
      responseDisposition: createContentDisposition(input.fileName),
    });

    return { url, expiresAt: input.expiresAt };
  }
}

function parseOptionalInteger(
  value: string | number | undefined,
): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function createContentDisposition(fileName: string): string {
  const normalizedFileName = [...fileName]
    .map((character) => {
      const code = character.charCodeAt(0);

      return code < 32 || code === 127 ? '_' : character;
    })
    .join('');
  const fallbackFileName = normalizedFileName
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encodedFileName = encodeURIComponent(normalizedFileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`;
}
