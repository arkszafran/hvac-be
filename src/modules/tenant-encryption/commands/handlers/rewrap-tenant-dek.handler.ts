import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import {
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { TenantKeyService } from '../../tenant-key.service';
import { RewrapTenantDekCommand } from '../impl/rewrap-tenant-dek.command';

type RewrapTenantDekResult = {
  readonly tenantId: string;
  readonly keyVersion: number;
};

@CommandHandler(RewrapTenantDekCommand)
export class RewrapTenantDekHandler implements ICommandHandler<
  RewrapTenantDekCommand,
  ApiSuccessResponse<RewrapTenantDekResult>
> {
  constructor(private readonly tenantKeyService: TenantKeyService) {}

  async execute(
    command: RewrapTenantDekCommand,
  ): Promise<ApiSuccessResponse<RewrapTenantDekResult>> {
    await this.tenantKeyService.rewrapKey(command.tenantId, command.keyVersion);

    return apiSuccess({
      tenantId: command.tenantId,
      keyVersion: command.keyVersion,
    });
  }
}
