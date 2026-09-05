import { GetCustomerDetailsHandler } from './handlers/get-customer-details.handler';
import { ListCustomersHandler } from './handlers/list-customers.handler';

export const CustomersQueryHandlers = [
  ListCustomersHandler,
  GetCustomerDetailsHandler,
];
