import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../audit/auditoria.module.js';
import { TrabajadoresController } from './trabajadores.controller.js';
import { TrabajadoresPolicy } from './trabajadores.policy.js';
import { TrabajadoresService } from './trabajadores.service.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [TrabajadoresController],
  providers: [TrabajadoresPolicy, TrabajadoresService],
})
export class TrabajadoresModule {}
