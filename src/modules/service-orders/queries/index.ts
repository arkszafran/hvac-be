import { GetServiceOrderDetailsHandler } from './handlers/get-service-order-details.handler';
import { ListInspectionServiceOrdersHandler } from './handlers/list-inspection-service-orders.handler';
import { ListServiceOrdersHandler } from './handlers/list-service-orders.handler';

export const ServiceOrdersQueryHandlers = [
  ListInspectionServiceOrdersHandler,
  ListServiceOrdersHandler,
  GetServiceOrderDetailsHandler,
];
