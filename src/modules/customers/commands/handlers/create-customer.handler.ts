import { ConflictException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import { CustomerEmailLookupService } from '../../customer-email-lookup.service';
import { buildCustomerPii, mapCustomerDto } from '../../customers.mapper';
import { CUSTOMERS_ERROR_CODES } from '../../customers.constants';
import type { CustomerDto } from '../../dto/customer-response.dto';
import { CustomersRepository } from '../../infrastructure/customers.repository';
import { CreateCustomerCommand } from '../impl/create-customer.command';

@CommandHandler(CreateCustomerCommand)
export class CreateCustomerHandler implements ICommandHandler<
  CreateCustomerCommand,
  ApiSuccessResponse<CustomerDto>
> {
  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly piiCipher: TenantPiiCipherService,
    private readonly emailLookupService: CustomerEmailLookupService,
  ) {}

  async execute(
    command: CreateCustomerCommand,
  ): Promise<ApiSuccessResponse<CustomerDto>> {
    const customerId = await this.customersRepository.generateId();
    const pii = buildCustomerPii(command.dto);
    const emailLookup = this.emailLookupService.create(
      command.tenantId,
      pii.email,
    );

    if (
      await this.customersRepository.hasEmailLookupHash(
        command.tenantId,
        emailLookup.hash,
      )
    ) {
      throwEmailAlreadyExists();
    }

    const encryptedPii = await this.piiCipher.encryptJson({
      tenantId: command.tenantId,
      recordId: customerId,
      purpose: ENCRYPTION_PURPOSES.customerPii,
      value: pii,
    });

    try {
      const customer = await this.customersRepository.create({
        id: customerId,
        tenantId: command.tenantId,
        type: command.dto.type,
        encryptedPii,
        emailLookupHash: emailLookup.hash,
        emailLookupKeyVersion: emailLookup.keyVersion,
      });

      return apiSuccess(mapCustomerDto(customer, pii));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throwEmailAlreadyExists();
      }

      throw error;
    }
  }
}

function throwEmailAlreadyExists(): never {
  throw new ConflictException(
    apiError({
      code: CUSTOMERS_ERROR_CODES.emailAlreadyExists,
      message: 'Customer with this email already exists.',
    }),
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
