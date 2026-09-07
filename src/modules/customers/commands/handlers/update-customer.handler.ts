import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { ENCRYPTION_PURPOSES } from '../../../../common/encryption/encryption.types';
import {
  apiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '../../../../common/types/api-response.type';
import { TenantPiiCipherService } from '../../../tenant-encryption/tenant-pii-cipher.service';
import { CustomerEmailLookupService } from '../../customer-email-lookup.service';
import { CUSTOMERS_ERROR_CODES } from '../../customers.constants';
import { buildCustomerPii, mapCustomerDto } from '../../customers.mapper';
import { parseCustomerPii } from '../../customers.types';
import type { CustomerDto } from '../../dto/customer-response.dto';
import { CustomersReadRepository } from '../../infrastructure/customers.read-repository';
import { CustomersRepository } from '../../infrastructure/customers.repository';
import { UpdateCustomerCommand } from '../impl/update-customer.command';

@CommandHandler(UpdateCustomerCommand)
export class UpdateCustomerHandler implements ICommandHandler<
  UpdateCustomerCommand,
  ApiSuccessResponse<CustomerDto>
> {
  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly customersReadRepository: CustomersReadRepository,
    private readonly piiCipher: TenantPiiCipherService,
    private readonly emailLookupService: CustomerEmailLookupService,
  ) {}

  async execute(
    command: UpdateCustomerCommand,
  ): Promise<ApiSuccessResponse<CustomerDto>> {
    const currentCustomer = await this.customersReadRepository.findById(
      command.tenantId,
      command.customerId,
    );

    if (!currentCustomer) {
      throwCustomerNotFound();
    }

    const currentPii = parseCustomerPii(
      await this.piiCipher.decryptJson({
        tenantId: command.tenantId,
        recordId: currentCustomer.id,
        purpose: ENCRYPTION_PURPOSES.customerPii,
        encrypted: {
          ciphertext: currentCustomer.piiCiphertext,
          nonce: currentCustomer.piiNonce,
          keyVersion: currentCustomer.piiKeyVersion,
          formatVersion: currentCustomer.piiFormatVersion,
        },
      }),
    );
    const pii = buildCustomerPii({
      companyName:
        command.dto.companyName === undefined
          ? currentPii.companyName
          : command.dto.companyName,
      fullName:
        command.dto.fullName === undefined
          ? currentPii.fullName
          : command.dto.fullName,
      phone: command.dto.phone ?? currentPii.phone,
      email: command.dto.email ?? currentPii.email,
      address: command.dto.address ?? currentPii.address,
      postalCode: command.dto.postalCode ?? currentPii.postalCode,
      city: command.dto.city ?? currentPii.city,
    });
    const emailLookup = this.emailLookupService.create(
      command.tenantId,
      pii.email,
    );

    if (
      await this.customersRepository.hasEmailLookupHash(
        command.tenantId,
        emailLookup.hash,
        undefined,
        command.customerId,
      )
    ) {
      throwEmailAlreadyExists();
    }

    const encryptedPii = await this.piiCipher.encryptJson({
      tenantId: command.tenantId,
      recordId: command.customerId,
      purpose: ENCRYPTION_PURPOSES.customerPii,
      value: pii,
    });

    try {
      const updatedCustomer = await this.customersRepository.update({
        id: command.customerId,
        tenantId: command.tenantId,
        type: command.dto.type ?? currentCustomer.type,
        encryptedPii,
        emailLookupHash: emailLookup.hash,
        emailLookupKeyVersion: emailLookup.keyVersion,
      });

      if (!updatedCustomer) {
        throwCustomerNotFound();
      }

      return apiSuccess(mapCustomerDto(updatedCustomer, pii));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throwEmailAlreadyExists();
      }

      throw error;
    }
  }
}

function throwCustomerNotFound(): never {
  throw new NotFoundException(
    apiError({
      code: CUSTOMERS_ERROR_CODES.notFound,
      message: 'Customer was not found.',
    }),
  );
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
