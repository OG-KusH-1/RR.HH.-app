import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../audit/auditoria.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { FichasService } from './fichas.service.js';
import { FichasPolicy, TrabajadoresController } from './trabajadores.controller.js';
import { TrabajadoresPolicy } from './trabajadores.policy.js';
import { TrabajadoresService } from './trabajadores.service.js';

@Module({
  imports: [AuditoriaModule, AuthModule],
  controllers: [TrabajadoresController],
  providers: [TrabajadoresPolicy, TrabajadoresService, FichasPolicy, FichasService],
})
export class TrabajadoresModule {}
