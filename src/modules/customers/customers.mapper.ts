import { CustomerType } from '@generated/prisma/enums';

import type {
  CustomerDto,
  CustomerListItemDto,
  CustomerServiceOrderDto,
} from './dto/customer-response.dto';
import type {
  CustomerPii,
  StoredCustomerMetadata,
  StoredServiceOrder,
} from './customers.types';

export function buildCustomerPii(input: CustomerPii): CustomerPii {
  return {
    companyName: input.companyName.trim(),
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().normalize('NFC'),
    address: input.address.trim(),
    postalCode: input.postalCode.trim(),
    city: input.city.trim(),
  };
}

export function mapCustomerDto(
  customer: StoredCustomerMetadata,
  pii: CustomerPii,
): CustomerDto {
  return {
    id: customer.id,
    type: customer.type,
    companyName: pii.companyName,
    fullName: pii.fullName,
    phone: pii.phone,
    email: pii.email,
    address: pii.address,
    postalCode: pii.postalCode,
    city: pii.city,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export function mapCustomerListItemDto(
  customer: StoredCustomerMetadata,
  pii: CustomerPii,
): CustomerListItemDto {
  return mapCustomerDto(customer, pii);
}

export function mapCustomerServiceOrderDto(
  serviceOrder: StoredServiceOrder,
): CustomerServiceOrderDto {
  return {
    id: serviceOrder.id,
    customerId: serviceOrder.customerId,
    type: serviceOrder.type,
    source: serviceOrder.source,
    status: serviceOrder.status,
    assigneeUserId: serviceOrder.assigneeUserId,
    orderDate: serviceOrder.orderDate.toISOString(),
    scheduledAt: serviceOrder.scheduledAt?.toISOString() ?? null,
    nextContactAt: serviceOrder.nextContactAt?.toISOString() ?? null,
    createdAt: serviceOrder.createdAt.toISOString(),
    updatedAt: serviceOrder.updatedAt.toISOString(),
  };
}

export function getCustomerDisplayName(customer: {
  readonly type: CustomerType;
  readonly companyName: string;
  readonly fullName: string;
}): string {
  return customer.type === CustomerType.company
    ? customer.companyName
    : customer.fullName;
}

export function normalizeCustomerSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/gi, (letter) => (letter === 'Ł' ? 'L' : 'l'))
    .toLocaleLowerCase('pl');
}
