import { Controller, Get, Ip, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { TrabajadoresPolicy } from './trabajadores.policy.js';
import { TrabajadoresService } from './trabajadores.service.js';

@Controller('trabajadores')
export class TrabajadoresController {
  constructor(private readonly trabajadores: TrabajadoresService) {}

  @Get()
  @Can(TrabajadoresPolicy, 'listar')
  listar(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.trabajadores.listar(usuario);
  }

  @Get('resumen')
  @Can(TrabajadoresPolicy, 'verResumen')
  resumen(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.trabajadores.resumenPorSede(usuario);
  }

  @Get(':id')
  @Can.Anyone()
  ver(@CurrentUser() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Ip() ip: string) {
    return this.trabajadores.ver(usuario, id, ip);
  }
}
