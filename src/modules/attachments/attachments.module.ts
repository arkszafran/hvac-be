import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthSecurityModule } from '@auth';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { PubSubModule } from '../../common/pubsub/pubsub.module';
import { AttachmentsCommandHandlers } from './commands';
import { AttachmentFileEventsController } from './controllers/attachment-file-events.controller';
import { AttachmentsController } from './controllers/attachments.controller';
import { AttachmentsReadRepository } from './infrastructure/attachments.read-repository';
import { AttachmentsRepository } from './infrastructure/attachments.repository';
import { GcsAttachmentsStorageService } from './infrastructure/gcs-attachments-storage.service';
import { AttachmentsQueryHandlers } from './queries';
import { AttachmentsPubSubOidcGuard } from './security/attachments-pubsub-oidc.guard';

@Module({
  imports: [CqrsModule, PrismaModule, AuthSecurityModule, PubSubModule],
  controllers: [AttachmentsController, AttachmentFileEventsController],
  providers: [
    AttachmentsRepository,
    AttachmentsReadRepository,
    GcsAttachmentsStorageService,
    AttachmentsPubSubOidcGuard,
    ...AttachmentsCommandHandlers,
    ...AttachmentsQueryHandlers,
  ],
})
export class AttachmentsModule {}
