import { Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { AvisosService } from './avisos.service.js';

/** Cada persona solo lee y marca sus propios avisos; el servicio filtra por destinatario. */
@Controller('avisos')
export class AvisosController {
  constructor(private readonly avisos: AvisosService) {}

  @Get()
  @Can.Anyone()
  listar(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.avisos.listar(usuario);
  }

  @Get('no-leidos')
  @Can.Anyone()
  async noLeidos(@CurrentUser() usuario: UsuarioAutenticado) {
    return { total: await this.avisos.noLeidas(usuario) };
  }

  @Post('leer-todos')
  @Can.Anyone()
  @HttpCode(204)
  leerTodos(@CurrentUser() usuario: UsuarioAutenticado) {
    return this.avisos.marcarTodas(usuario);
  }

  @Post(':id/leer')
  @Can.Anyone()
  @HttpCode(204)
  leer(@CurrentUser() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.avisos.marcarLeida(usuario, id);
  }
}

@Module({
  controllers: [AvisosController],
  providers: [AvisosService],
  exports: [AvisosService],
})
export class AvisosModule {}
