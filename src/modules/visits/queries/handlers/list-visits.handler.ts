import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';

import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import type {
  VisitListItemDto,
  VisitsListDataDto,
} from '../../dto/visit-response.dto';
import {
  VisitSortBy,
  VisitSortDirection,
} from '../../dto/visits-list-query.dto';
import { VisitsReadRepository } from '../../infrastructure/visits.read-repository';
import { VisitsMapper } from '../../visits.mapper';
import { ListVisitsQuery } from '../impl/list-visits.query';

@QueryHandler(ListVisitsQuery)
export class ListVisitsHandler implements IQueryHandler<
  ListVisitsQuery,
  ApiSuccessResponse<VisitsListDataDto>
> {
  constructor(
    private readonly repository: VisitsReadRepository,
    private readonly mapper: VisitsMapper,
    private readonly piiCipher: TenantPiiCipherService,
  ) {}

  async execute(
    query: ListVisitsQuery,
  ): Promise<ApiSuccessResponse<VisitsListDataDto>> {
    const visits = await this.repository.findAll(query.tenantId);
    const mapped = await Promise.all(
      visits.map((visit) => this.mapper.mapVisit(visit, this.piiCipher)),
    );
    const filtered = filterVisits(mapped, query.dto.q);
    const sorted = sortVisits(
      filtered,
      query.dto.sortBy ?? VisitSortBy.performedOn,
      query.dto.sortDirection ?? VisitSortDirection.desc,
    );
    const page = query.dto.page ?? 1;
    const pageSize = query.dto.pageSize ?? 20;
    const firstIndex = (page - 1) * pageSize;

    return apiSuccess({
      items: sorted.slice(firstIndex, firstIndex + pageSize),
      pagination: {
        page,
        pageSize,
        totalItems: sorted.length,
        totalPages: Math.ceil(sorted.length / pageSize),
      },
    });
  }
}

function filterVisits(
  visits: readonly VisitListItemDto[],
  phrase?: string,
): VisitListItemDto[] {
  if (!phrase) {
    return [...visits];
  }

  const normalizedPhrase = normalizeSearchValue(phrase);

  return visits.filter((visit) =>
    [
      visit.type,
      visit.performedOn,
      visit.handledBy.name,
      visit.customer.companyName,
      visit.customer.fullName,
      visit.customer.phone,
      visit.customer.email,
      visit.customer.address,
      visit.customer.postalCode,
      visit.customer.city,
      ...visit.devices.flatMap(({ device, note }) => [
        device.type,
        device.brand,
        device.model,
        device.location,
        device.address,
        device.postalCode,
        device.city,
        note,
      ]),
    ].some(
      (value) =>
        value !== null &&
        normalizeSearchValue(value).includes(normalizedPhrase),
    ),
  );
}

function sortVisits(
  visits: readonly VisitListItemDto[],
  sortBy: VisitSortBy,
  sortDirection: VisitSortDirection,
): VisitListItemDto[] {
  const direction = sortDirection === VisitSortDirection.asc ? 1 : -1;

  return [...visits].sort((left, right) => {
    const leftValue =
      sortBy === VisitSortBy.createdAt ? left.createdAt : left.performedOn;
    const rightValue =
      sortBy === VisitSortBy.createdAt ? right.createdAt : right.performedOn;
    const comparison = leftValue.localeCompare(rightValue) * direction;

    return comparison || left.id.localeCompare(right.id) * direction;
  });
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/gi, (character) => (character === 'Ł' ? 'L' : 'l'))
    .toLocaleLowerCase('pl');
}
