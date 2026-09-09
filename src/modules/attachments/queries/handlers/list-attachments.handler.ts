import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { mapAttachmentDto } from '../../attachments.mapper';
import type { AttachmentsListDataDto } from '../../dto/attachment-response.dto';
import { AttachmentsReadRepository } from '../../infrastructure/attachments.read-repository';
import { ListAttachmentsQuery } from '../impl/list-attachments.query';

@QueryHandler(ListAttachmentsQuery)
export class ListAttachmentsHandler implements IQueryHandler<
  ListAttachmentsQuery,
  ApiSuccessResponse<AttachmentsListDataDto>
> {
  constructor(
    private readonly attachmentsReadRepository: AttachmentsReadRepository,
  ) {}

  async execute(
    query: ListAttachmentsQuery,
  ): Promise<ApiSuccessResponse<AttachmentsListDataDto>> {
    const attachmentIds = [...new Set(query.attachmentIds)];
    const attachments = await this.attachmentsReadRepository.findByTenantAndIds(
      query.tenantId,
      attachmentIds,
    );
    const attachmentsById = new Map(
      attachments.map((attachment) => [attachment.id, attachment]),
    );

    return apiSuccess({
      attachments: attachmentIds.flatMap((attachmentId) => {
        const attachment = attachmentsById.get(attachmentId);

        return attachment ? [mapAttachmentDto(attachment)] : [];
      }),
    });
  }
}
