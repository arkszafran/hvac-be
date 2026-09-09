import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@generated/prisma/enums';
import {
  AuthGuard,
  AuthRoles,
  RoleAuthGuard,
  TenantGuard,
  TenantId,
} from '@auth';

import { AUTH_COOKIE_NAMES } from '../../authentication/authentication.constants';
import { PrepareAttachmentUploadsCommand } from '../commands/impl/prepare-attachment-uploads.command';
import {
  AttachmentDownloadResponseDto,
  AttachmentResponseDto,
  AttachmentsErrorResponseDto,
  AttachmentsListResponseDto,
  PrepareAttachmentUploadsResponseDto,
} from '../dto/attachment-response.dto';
import { AttachmentsListQueryDto } from '../dto/attachments-list-query.dto';
import { PrepareAttachmentUploadsDto } from '../dto/prepare-attachment-uploads.dto';
import { GetAttachmentDownloadUrlQuery } from '../queries/impl/get-attachment-download-url.query';
import { GetAttachmentQuery } from '../queries/impl/get-attachment.query';
import { ListAttachmentsQuery } from '../queries/impl/list-attachments.query';

@ApiTags('attachments')
@ApiCookieAuth(AUTH_COOKIE_NAMES.accessToken)
@ApiProduces('application/json')
@ApiHeader({
  name: 'x-tenant-id',
  required: true,
  description: 'Tenant selected by the authenticated user.',
})
@UseGuards(AuthGuard, TenantGuard, RoleAuthGuard)
@AuthRoles({ userRole: UserRole.TENANT_USER })
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('upload-requests')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Prepare one or more direct uploads to Cloud Storage',
    description: `
This endpoint does not receive file bytes. It creates attachment records and returns one signed HTML form per file.

Frontend flow for every item returned in \`data.attachments\`:

1. Create a new \`FormData\` instance.
2. Append every key/value pair from \`upload.fields\` to that form.
3. Append the browser \`File\` as field \`file\` **after all signed fields**.
4. POST the form directly to \`upload.url\`. Do not send API cookies or an Authorization header to Cloud Storage.
5. Do not manually set the multipart \`Content-Type\` header; the browser must add its boundary.
6. Upload returned forms in parallel. A successful Storage response means only that the upload completed, not that the file is safe.
7. Poll \`GET /attachments?ids=...\` until each status becomes \`clean\` or \`quarantined\`.
8. Request \`GET /attachments/{attachmentId}/download-url\` only when \`canDownload\` is true.

Signed forms expire after 10 minutes. Request new forms instead of retrying an expired one.
`,
  })
  @ApiConsumes('application/json')
  @ApiBody({ type: PrepareAttachmentUploadsDto })
  @ApiCreatedResponse({
    type: PrepareAttachmentUploadsResponseDto,
    description:
      'Attachment records and signed multipart forms were created successfully.',
  })
  @ApiBadRequestResponse({ type: AttachmentsErrorResponseDto })
  @ApiUnauthorizedResponse({ type: AttachmentsErrorResponseDto })
  @ApiForbiddenResponse({ type: AttachmentsErrorResponseDto })
  prepareUploads(
    @TenantId() tenantId: string,
    @Body() dto: PrepareAttachmentUploadsDto,
  ): Promise<PrepareAttachmentUploadsResponseDto> {
    return this.commandBus.execute(
      new PrepareAttachmentUploadsCommand(tenantId, dto),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get current statuses of multiple attachments',
    description:
      'Pass the IDs returned by the upload preparation endpoint as one comma-separated query parameter. Unknown IDs and attachments owned by another tenant are omitted. Poll only while a returned status is pending_upload or scanning.',
  })
  @ApiQuery({
    name: 'ids',
    required: true,
    type: String,
    description: 'One to 50 comma-separated attachment UUIDs.',
  })
  @ApiOkResponse({ type: AttachmentsListResponseDto })
  @ApiBadRequestResponse({ type: AttachmentsErrorResponseDto })
  @ApiUnauthorizedResponse({ type: AttachmentsErrorResponseDto })
  @ApiForbiddenResponse({ type: AttachmentsErrorResponseDto })
  list(
    @TenantId() tenantId: string,
    @Query() dto: AttachmentsListQueryDto,
  ): Promise<AttachmentsListResponseDto> {
    return this.queryBus.execute(new ListAttachmentsQuery(tenantId, dto.ids));
  }

  @Get(':attachmentId/download-url')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create a short-lived URL for a clean attachment',
    description:
      'Call this endpoint only when canDownload is true. The returned URL is valid for five minutes, must not be persisted, and points only to the clean bucket. Pending, scanning, failed and quarantined files return HTTP 409.',
  })
  @ApiParam({ name: 'attachmentId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AttachmentDownloadResponseDto })
  @ApiConflictResponse({ type: AttachmentsErrorResponseDto })
  @ApiNotFoundResponse({ type: AttachmentsErrorResponseDto })
  @ApiUnauthorizedResponse({ type: AttachmentsErrorResponseDto })
  @ApiForbiddenResponse({ type: AttachmentsErrorResponseDto })
  downloadUrl(
    @TenantId() tenantId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' }))
    attachmentId: string,
  ): Promise<AttachmentDownloadResponseDto> {
    return this.queryBus.execute(
      new GetAttachmentDownloadUrlQuery(tenantId, attachmentId),
    );
  }

  @Get(':attachmentId')
  @ApiOperation({
    summary: 'Get one attachment and its scan status',
    description:
      'Returns tenant-scoped metadata only. It never includes a permanent Storage URL.',
  })
  @ApiParam({ name: 'attachmentId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AttachmentResponseDto })
  @ApiNotFoundResponse({ type: AttachmentsErrorResponseDto })
  @ApiUnauthorizedResponse({ type: AttachmentsErrorResponseDto })
  @ApiForbiddenResponse({ type: AttachmentsErrorResponseDto })
  details(
    @TenantId() tenantId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' }))
    attachmentId: string,
  ): Promise<AttachmentResponseDto> {
    return this.queryBus.execute(
      new GetAttachmentQuery(tenantId, attachmentId),
    );
  }
}
