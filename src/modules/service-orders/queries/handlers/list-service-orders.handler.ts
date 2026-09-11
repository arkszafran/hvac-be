import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { ServiceOrderStatus } from '@generated/prisma/enums';

import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import type {
  ServiceOrderListItemDto,
  ServiceOrdersListDataDto,
} from '../../dto/service-orders-list-response.dto';
import {
  ServiceOrderSortBy,
  ServiceOrderSortDirection,
} from '../../dto/service-orders-list-query.dto';
import { ServiceOrdersReadRepository } from '../../infrastructure/service-orders.read-repository';
import {
  normalizeServiceOrderSearchValue,
  ServiceOrdersMapper,
} from '../../service-orders.mapper';
import { ListServiceOrdersQuery } from '../impl/list-service-orders.query';
import { ACTIVE_INSPECTION_STATUSES } from '../../service-orders.constants';

@QueryHandler(ListServiceOrdersQuery)
export class ListServiceOrdersHandler implements IQueryHandler<
  ListServiceOrdersQuery,
  ApiSuccessResponse<ServiceOrdersListDataDto>
> {
  constructor(
    private readonly repository: ServiceOrdersReadRepository,
    private readonly mapper: ServiceOrdersMapper,
  ) {}

  async execute(
    query: ListServiceOrdersQuery,
  ): Promise<ApiSuccessResponse<ServiceOrdersListDataDto>> {
    const statuses = resolveStatuses(query.dto.statuses, query.dto.active);
    const rows = await this.repository.findList({
      tenantId: query.tenantId,
      ...(query.dto.customerId ? { customerId: query.dto.customerId } : {}),
      ...(query.dto.type ? { type: query.dto.type } : {}),
      ...(statuses ? { statuses } : {}),
      ...(query.dto.excludeDeviceId
        ? { excludeDeviceId: query.dto.excludeDeviceId }
        : {}),
    });
    const mapped = await Promise.all(
      rows.map((row) => this.mapper.mapListItem(row)),
    );
    const filtered = filterServiceOrders(mapped, query.dto.q);
    const sorted = sortServiceOrders(
      filtered,
      query.dto.sortBy ?? ServiceOrderSortBy.orderDate,
      query.dto.sortDirection ?? ServiceOrderSortDirection.desc,
    );
    const page = query.dto.page ?? 1;
    const pageSize = query.dto.pageSize ?? 20;
    const start = (page - 1) * pageSize;

    return apiSuccess({
      items: sorted.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        totalItems: sorted.length,
        totalPages: Math.ceil(sorted.length / pageSize),
      },
    });
  }
}

function resolveStatuses(
  statuses: readonly ServiceOrderStatus[] | undefined,
  active: string | undefined,
): ServiceOrderStatus[] | undefined {
  if (active !== 'true') {
    return statuses ? [...statuses] : undefined;
  }

  const activeStatuses = new Set<ServiceOrderStatus>(
    ACTIVE_INSPECTION_STATUSES,
  );

  return statuses
    ? statuses.filter((status) => activeStatuses.has(status))
    : [...ACTIVE_INSPECTION_STATUSES];
}

function filterServiceOrders(
  items: readonly ServiceOrderListItemDto[],
  phrase?: string,
): ServiceOrderListItemDto[] {
  if (!phrase) {
    return [...items];
  }

  const normalizedPhrase = normalizeServiceOrderSearchValue(phrase);

  return items.filter((item) =>
    [
      item.order.id,
      item.order.type,
      item.order.source,
      item.order.status,
      item.customer.companyName,
      item.customer.fullName,
      item.customer.phone,
      item.customer.email,
      item.customer.address,
      item.customer.postalCode,
      item.customer.city,
      item.assignee?.name,
      item.assignee?.email,
      ...item.devices.flatMap((device) => [
        device.brand,
        device.model,
        device.serialNumber,
        device.refrigerant,
        device.refrigerantAmount,
        device.displayedError,
        device.location,
        device.address,
        device.postalCode,
        device.city,
      ]),
    ].some(
      (value) =>
        value !== null &&
        value !== undefined &&
        normalizeServiceOrderSearchValue(value).includes(normalizedPhrase),
    ),
  );
}

function sortServiceOrders(
  items: readonly ServiceOrderListItemDto[],
  sortBy: ServiceOrderSortBy,
  direction: ServiceOrderSortDirection,
): ServiceOrderListItemDto[] {
  const multiplier = direction === ServiceOrderSortDirection.asc ? 1 : -1;

  return [...items].sort((left, right) => {
    const leftValue = left.order[sortBy];
    const rightValue = right.order[sortBy];

    if (leftValue === rightValue) {
      return left.order.id.localeCompare(right.order.id) * multiplier;
    }

    if (leftValue === null) return 1;
    if (rightValue === null) return -1;

    return leftValue.localeCompare(rightValue) * multiplier;
  });
}
