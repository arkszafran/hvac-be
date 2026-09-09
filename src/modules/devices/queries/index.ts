import { GetDeviceDetailsHandler } from './handlers/get-device-details.handler';
import { ListDevicesHandler } from './handlers/list-devices.handler';

export const DevicesQueryHandlers = [
  ListDevicesHandler,
  GetDeviceDetailsHandler,
];
