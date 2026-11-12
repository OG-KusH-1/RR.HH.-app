import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditoriaModule } from '../audit/auditoria.module.js';
import type { Env } from '../config/env.js';
import { CmfFuente } from './fuentes/cmf.fuente.js';
import { FUENTES_INDICADORES, type FuenteIndicadores } from './fuentes/fuente-indicadores.js';
import { MindicadorFuente } from './fuentes/mindicador.fuente.js';
import { IndicadoresService } from './indicadores.service.js';
import { PrevisionalController } from './previsional.controller.js';
import { PrevisionalPolicy } from './previsional.policy.js';
import { PrevisionalService } from './previsional.service.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [PrevisionalController],
  providers: [
    PrevisionalPolicy,
    PrevisionalService,
    IndicadoresService,
    {
      // Orden de preferencia: la fuente oficial primero, el respaldo después.
      provide: FUENTES_INDICADORES,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): FuenteIndicadores[] => {
        const clave = config.get('CMF_API_KEY', { infer: true });
        return [...(clave ? [new CmfFuente(clave)] : []), new MindicadorFuente()];
      },
    },
  ],
})
export class PrevisionalModule {}
