import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  UpdateDeviceServiceOrderAction,
  UpdateDeviceServiceOrderCommandDto,
} from './update-device.dto';

describe('UpdateDeviceServiceOrderCommandDto', () => {
  it('accepts rescheduling with currentServiceOrderId and no confirmation flag', async () => {
    const dto = plainToInstance(UpdateDeviceServiceOrderCommandDto, {
      action: UpdateDeviceServiceOrderAction.rescheduleInspection,
      currentServiceOrderId: '2ef45a32-f4e2-4b0c-a70f-b0ecc74bed32',
      scheduledAt: '2027-03-27T15:00',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
