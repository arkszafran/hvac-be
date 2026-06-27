import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthGuard, RoleAuthGuard, TenantGuard } from './guards';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  providers: [AuthGuard, RoleAuthGuard, TenantGuard],
  exports: [JwtModule, AuthGuard, RoleAuthGuard, TenantGuard],
})
export class AuthSecurityModule {}
