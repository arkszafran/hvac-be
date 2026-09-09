import { BadRequestException, Injectable } from '@nestjs/common';

import { apiError } from '../types/api-response.type';

const BASE64_PATTERN =
  /^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/;

@Injectable()
export class PubSubMessageDecoderService {
  decodeJson(data: string): unknown {
    if (!BASE64_PATTERN.test(data)) {
      throwInvalidMessageData();
    }

    try {
      const decoded = Buffer.from(data, 'base64').toString('utf8');

      return JSON.parse(decoded) as unknown;
    } catch {
      throwInvalidMessageData();
    }
  }
}

function throwInvalidMessageData(): never {
  throw new BadRequestException(
    apiError({
      code: 'PUBSUB_MESSAGE_DATA_INVALID',
      message: 'Pub/Sub message data must contain valid Base64-encoded JSON.',
    }),
  );
}
