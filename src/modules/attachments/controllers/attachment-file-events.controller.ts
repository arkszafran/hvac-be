import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { PubSubPushEnvelopeDto } from '../../../common/pubsub/dto/pubsub-push-envelope.dto';
import { SkipOriginCheck } from '../../../common/security/origin/skip-origin-check.decorator';
import { ProcessAttachmentFileEventCommand } from '../commands/impl/process-attachment-file-event.command';
import {
  AttachmentEventAcceptedResponseDto,
  AttachmentsErrorResponseDto,
} from '../dto/attachment-response.dto';
import { AttachmentsPubSubOidcGuard } from '../security/attachments-pubsub-oidc.guard';

@ApiTags('internal-pubsub')
@ApiProduces('application/json')
@ApiBearerAuth('pubsubOidc')
@UseGuards(AttachmentsPubSubOidcGuard)
@SkipThrottle()
@SkipOriginCheck()
@Controller('internal/pubsub')
export class AttachmentFileEventsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('attachment-file-events')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Internal] Receive attachment scan state events from Pub/Sub',
    description:
      'Google Pub/Sub calls this endpoint. Frontend applications must never call it. It requires a Google-signed OIDC bearer token with the configured audience and service-account email. HTTP 200 acknowledges a processed, duplicate, stale or unknown-object event. Validation and transient processing errors are retried by Pub/Sub and can reach the configured dead-letter topic.',
  })
  @ApiBody({ type: PubSubPushEnvelopeDto })
  @ApiOkResponse({ type: AttachmentEventAcceptedResponseDto })
  @ApiBadRequestResponse({ type: AttachmentsErrorResponseDto })
  @ApiUnauthorizedResponse({ type: AttachmentsErrorResponseDto })
  handle(
    @Body() envelope: PubSubPushEnvelopeDto,
  ): Promise<AttachmentEventAcceptedResponseDto> {
    return this.commandBus.execute(
      new ProcessAttachmentFileEventCommand(envelope),
    );
  }
}
