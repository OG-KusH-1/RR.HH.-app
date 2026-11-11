import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';

@Public()
@Controller('salud')
export class HealthController {
  @Get()
  estado() {
    return { estado: 'ok' };
  }
}
