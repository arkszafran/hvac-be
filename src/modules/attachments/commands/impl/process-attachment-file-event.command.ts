import type { PubSubPushEnvelopeDto } from '../../../../common/pubsub/dto/pubsub-push-envelope.dto';

export class ProcessAttachmentFileEventCommand {
  constructor(public readonly envelope: PubSubPushEnvelopeDto) {}
}
