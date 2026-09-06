import { CreateDeviceHandler } from './handlers/create-device.handler';
import { UpdateDeviceHandler } from './handlers/update-device.handler';

export const DevicesCommandHandlers = [
  CreateDeviceHandler,
  UpdateDeviceHandler,
];
