import { NotFoundException } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { ATTACHMENTS_ERROR_CODES } from '../../attachments.constants';
import { mapAttachmentDto } from '../../attachments.mapper';
import type { AttachmentDto } from '../../dto/attachment-response.dto';
import { AttachmentsReadRepository } from '../../infrastructure/attachments.read-repository';
import { GetAttachmentQuery } from '../impl/get-attachment.query';

@QueryHandler(GetAttachmentQuery)
export class GetAttachmentHandler implements IQueryHandler<
  GetAttachmentQuery,
  ApiSuccessResponse<AttachmentDto>
> {
  constructor(
    private readonly attachmentsReadRepository: AttachmentsReadRepository,
  ) {}

  async execute(
    query: GetAttachmentQuery,
  ): Promise<ApiSuccessResponse<AttachmentDto>> {
    const attachment = await this.attachmentsReadRepository.findByTenantAndId(
      query.tenantId,
      query.attachmentId,
    );

    if (!attachment) {
      throwAttachmentNotFound();
    }

    return apiSuccess(mapAttachmentDto(attachment));
  }
}

function throwAttachmentNotFound(): never {
  throw new NotFoundException(
    apiError({
      code: ATTACHMENTS_ERROR_CODES.notFound,
      message: 'Attachment was not found.',
    }),
  );
}
