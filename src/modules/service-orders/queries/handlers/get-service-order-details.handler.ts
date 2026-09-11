import { NotFoundException } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import type { ServiceOrderDetailsDto } from '../../dto/service-order-details-response.dto';
import { ServiceOrdersReadRepository } from '../../infrastructure/service-orders.read-repository';
import { SERVICE_ORDERS_ERROR_CODES } from '../../service-orders.constants';
import { ServiceOrdersMapper } from '../../service-orders.mapper';
import { GetServiceOrderDetailsQuery } from '../impl/get-service-order-details.query';

@QueryHandler(GetServiceOrderDetailsQuery)
export class GetServiceOrderDetailsHandler implements IQueryHandler<
  GetServiceOrderDetailsQuery,
  ApiSuccessResponse<ServiceOrderDetailsDto>
> {
  constructor(
    private readonly repository: ServiceOrdersReadRepository,
    private readonly mapper: ServiceOrdersMapper,
  ) {}

  async execute(
    query: GetServiceOrderDetailsQuery,
  ): Promise<ApiSuccessResponse<ServiceOrderDetailsDto>> {
    if (query.omitAttachments) {
      const row = await this.repository.findDetailsWithoutAttachments(
        query.tenantId,
        query.serviceOrderId,
      );

      if (!row) throwNotFound();

      return apiSuccess(await this.mapper.mapDetailsWithoutAttachments(row));
    }

    const row = await this.repository.findDetailsWithAttachments(
      query.tenantId,
      query.serviceOrderId,
    );

    if (!row) throwNotFound();

    return apiSuccess(await this.mapper.mapDetailsWithAttachments(row));
  }
}

function throwNotFound(): never {
  throw new NotFoundException(
    apiError({
      code: SERVICE_ORDERS_ERROR_CODES.notFound,
      message: 'Service order was not found.',
    }),
  );
}
