import { CreateCustomerHandler } from './handlers/create-customer.handler';
import { UpdateCustomerHandler } from './handlers/update-customer.handler';

export const CustomersCommandHandlers = [
  CreateCustomerHandler,
  UpdateCustomerHandler,
];
