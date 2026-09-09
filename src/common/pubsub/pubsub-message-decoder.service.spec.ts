import { BadRequestException } from '@nestjs/common';

import { PubSubMessageDecoderService } from './pubsub-message-decoder.service';

describe('PubSubMessageDecoderService', () => {
  const service = new PubSubMessageDecoderService();

  it('decodes Base64 JSON', () => {
    const value = { bucket: 'clean-bucket', size: '123' };

    expect(
      service.decodeJson(Buffer.from(JSON.stringify(value)).toString('base64')),
    ).toEqual(value);
  });

  it.each([
    'not base64',
    'YWJjZA===',
    Buffer.from('not-json').toString('base64'),
  ])('rejects invalid data %s', (data) => {
    expect(() => service.decodeJson(data)).toThrow(BadRequestException);
  });
});
