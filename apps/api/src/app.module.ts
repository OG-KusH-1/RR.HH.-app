import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { DrizzleModule } from '@nestjs/drizzle';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { drizzle } from 'drizzle-orm/node-postgres';
import { AuthModule } from './auth/auth.module.js';
import { validarEnv, type Env } from './config/env.js';
import { relations } from './db/relations.js';
import { TrabajadoresModule } from './employees/trabajadores.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        drizzle,
        connection: config.get('DATABASE_URL', { infer: true }),
        relations,
      }),
    }),
    // La autenticación va antes que la autorización: su guardia debe correr primero.
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        session: {
          absoluteTtl: '12h', // una jornada laboral
          idleTtl: '2h',
          trustedOrigins: [config.get('WEB_ORIGIN', { infer: true })],
        },
      }),
    }),
    AuthorizationModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule,
    TrabajadoresModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
