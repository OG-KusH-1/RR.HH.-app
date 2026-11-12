/**
 * Certificados verificables (épica E5, HU-18).
 *
 * Cómo funciona la verificación:
 * - Cada certificado tiene un código aleatorio de 60 bits (12 caracteres) impreso y en un QR.
 * - Un banco o una inmobiliaria abre /verificar/<código> sin cuenta y ve si es auténtico.
 * - La página pública muestra solo lo que ya dice el papel, con el RUT parcialmente oculto:
 *   no revela nada nuevo a quien tiene el código, y sin el código no se puede consultar nada.
 * - El contenido se guarda como copia (`datos`): si la ficha cambia, el certificado no cambia.
 *   Personas puede revocarlo (por ejemplo, si se emitió con un error) y la verificación lo indicará.
 */
import { Body, Controller, Get, HttpCode, Injectable, Ip, Module, NotFoundException, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser, Public } from '@nestjs/authentication';
import { Can, Policy } from '@nestjs/authorization';
import { InjectDrizzle } from '@nestjs/drizzle';
import { Throttle } from '@nestjs/throttler';
import { and, desc, eq } from 'drizzle-orm';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { z } from 'zod';
import { AuditoriaModule } from '../audit/auditoria.module.js';
import { AuditoriaService } from '../audit/auditoria.service.js';
import { hoyEn } from '../ausencias/calendario-laboral.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { generarPdf } from '../common/pdf.js';
import type { Env } from '../config/env.js';
import type { Database } from '../db/database.js';
import { certificados, empresas, sedes, trabajadores } from '../db/schema.js';

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: sin I, L, O, U para evitar confusiones al dictarlo.

/** 12 caracteres de un alfabeto de 32 = 60 bits de azar, en grupos de 4: "7K3M-9QX2-4PTA". */
export function generarCodigo(bytes: Buffer = randomBytes(8)): string {
  let n = BigInt(`0x${bytes.toString('hex')}`);
  let texto = '';
  for (let i = 0; i < 12; i++) {
    texto += ALFABETO[Number(n & 31n)];
    n >>= 5n;
  }
  return `${texto.slice(0, 4)}-${texto.slice(4, 8)}-${texto.slice(8)}`;
}

/** "12.403.288-1" → "12.4**.***-1": suficiente para que el verificador compare con el papel. */
export function enmascararRut(rut: string): string {
  const [cuerpo, dv] = rut.split('-');
  const visible = cuerpo.slice(0, 3);
  const oculto = '*'.repeat(cuerpo.length - 3);
  const junto = (visible + oculto).replace(/\B(?=(.{3})+(?!.))/g, '.');
  return `${junto}-${dv}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (f: string) => {
  const [a, m, d] = f.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
};
const CONTRATO: Record<string, string> = { INDEFINIDO: 'indefinido', PLAZO_FIJO: 'a plazo fijo', OBRA_FAENA: 'por obra o faena' };
const formatoRut = (rut: string) => {
  const [c, dv] = rut.split('-');
  return `${c.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
};

@Injectable()
export class CertificadosService {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async emitir(usuario: UsuarioAutenticado, trabajadorId: string, ip?: string) {
    // Cada persona emite el suyo; Personas puede emitir el de cualquiera.
    if (trabajadorId !== usuario.trabajadorId && usuario.rol !== 'PERSONAS') throw new NotFoundException('Ficha no encontrada');
    const [t] = await this.db
      .select({ t: trabajadores, empresa: empresas, sede: sedes.nombre, zona: sedes.zonaHoraria })
      .from(trabajadores)
      .innerJoin(empresas, eq(empresas.id, trabajadores.empresaId))
      .innerJoin(sedes, eq(sedes.id, trabajadores.sedeId))
      .where(eq(trabajadores.id, trabajadorId));
    if (!t || t.t.empresaId !== usuario.empresaId) throw new NotFoundException('Ficha no encontrada');
    if (t.t.estado !== 'ACTIVO') throw new NotFoundException('Solo se emiten certificados de antigüedad para personas con contrato vigente.');

    const datos: Record<string, string> = {
      nombre: `${t.t.nombres} ${t.t.apellidos}`,
      rut: t.t.rut,
      cargo: t.t.cargo,
      sede: t.sede,
      fechaIngreso: t.t.fechaIngreso,
      tipoContrato: t.t.tipoContrato,
      jornada: `${t.t.horasSemanales} horas semanales`,
      empresa: t.empresa.razonSocial,
      rutEmpresa: t.empresa.rut,
      emitido: hoyEn(t.zona),
    };
    const [cert] = await this.db
      .insert(certificados)
      .values({ empresaId: t.t.empresaId, trabajadorId, codigo: generarCodigo(), tipo: 'ANTIGUEDAD', datos, emitidoPor: usuario.id })
      .returning();
    await this.auditoria.registrar({ usuario, accion: 'EMITIR_CERTIFICADO', entidad: 'certificado', entidadId: cert.id, ip, detalle: { trabajadorId, codigo: cert.codigo } });
    return cert;
  }

  listar(usuario: UsuarioAutenticado, trabajadorId: string) {
    if (trabajadorId !== usuario.trabajadorId && usuario.rol !== 'PERSONAS') throw new NotFoundException('Ficha no encontrada');
    return this.db
      .select({ id: certificados.id, codigo: certificados.codigo, tipo: certificados.tipo, emitidoEn: certificados.emitidoEn, revocadoEn: certificados.revocadoEn })
      .from(certificados)
      .where(and(eq(certificados.trabajadorId, trabajadorId), eq(certificados.empresaId, usuario.empresaId)))
      .orderBy(desc(certificados.emitidoEn));
  }

  /** El PDF se regenera desde la copia guardada: siempre dice exactamente lo mismo. */
  async pdf(usuario: UsuarioAutenticado, id: string) {
    const [c] = await this.db.select().from(certificados).where(eq(certificados.id, id));
    if (!c || c.empresaId !== usuario.empresaId || (c.trabajadorId !== usuario.trabajadorId && usuario.rol !== 'PERSONAS')) throw new NotFoundException('Certificado no encontrado');
    const d = c.datos;
    const url = `${this.config.get('PORTAL_URL', { infer: true })}/verificar/${c.codigo}`;
    const qr = await QRCode.toBuffer(url, { margin: 1, width: 240, color: { dark: '#08404b' } });
    const bytes = await generarPdf({
      encabezado: d.empresa,
      subencabezado: `RUT ${formatoRut(d.rutEmpresa)}, Rapa Nui y Santiago`,
      titulo: 'Certificado de antigüedad laboral',
      parrafos: [
        `${d.empresa}, RUT ${formatoRut(d.rutEmpresa)}, certifica que ${d.nombre}, RUT ${formatoRut(d.rut)}, presta servicios en la empresa desde el ${fechaLarga(d.fechaIngreso)}, con contrato ${CONTRATO[d.tipoContrato] ?? d.tipoContrato}, desempeñándose actualmente como ${d.cargo}.`,
        'Se extiende el presente certificado a solicitud de la persona interesada, para los fines que estime convenientes.',
      ],
      datos: [
        ['Cargo', d.cargo],
        ['Lugar de trabajo', d.sede],
        ['Jornada', d.jornada],
        ['Fecha de emisión', fechaLarga(d.emitido)],
      ],
      firma: ['Gestión de Personas', d.empresa],
      pie: `Verifique la autenticidad de este certificado en ${url} o escaneando el código QR. Código: ${c.codigo}.`,
      imagen: qr,
    });
    return { bytes, nombre: `certificado-antiguedad-${c.codigo}.pdf` };
  }

  async verificar(codigo: string, ip?: string) {
    const limpio = codigo.toUpperCase().replace(/[^0-9A-Z]/g, '');
    const formateado = `${limpio.slice(0, 4)}-${limpio.slice(4, 8)}-${limpio.slice(8, 12)}`;
    const [c] = await this.db.select().from(certificados).where(eq(certificados.codigo, formateado));
    await this.auditoria.registrar({ accion: 'VERIFICAR_CERTIFICADO', entidad: 'certificado', entidadId: c?.id, ip, detalle: { encontrado: Boolean(c) } });
    if (!c) return { valido: false as const };
    const d = c.datos;
    return {
      valido: true as const,
      revocado: Boolean(c.revocadoEn),
      codigo: c.codigo,
      tipo: 'Certificado de antigüedad laboral',
      empresa: d.empresa,
      nombre: d.nombre,
      rut: enmascararRut(d.rut),
      cargo: d.cargo,
      fechaIngreso: d.fechaIngreso,
      tipoContrato: CONTRATO[d.tipoContrato] ?? d.tipoContrato,
      emitido: d.emitido,
    };
  }

  async revocar(usuario: UsuarioAutenticado, id: string, motivo: string, ip?: string) {
    const [c] = await this.db.select().from(certificados).where(eq(certificados.id, id));
    if (!c || c.empresaId !== usuario.empresaId) throw new NotFoundException('Certificado no encontrado');
    await this.db.update(certificados).set({ revocadoEn: new Date(), motivoRevocacion: motivo }).where(eq(certificados.id, id));
    await this.auditoria.registrar({ usuario, accion: 'REVOCAR_CERTIFICADO', entidad: 'certificado', entidadId: id, ip, detalle: { motivo } });
  }
}

@Policy()
export class CertificadosPolicy {
  usar(u: UsuarioAutenticado | null) {
    return u !== null;
  }

  gestionar(u: UsuarioAutenticado | null) {
    return u !== null && u.rol === 'PERSONAS';
  }
}

const emitirSchema = z.object({ trabajadorId: z.uuid().optional() });
const revocarSchema = z.object({ motivo: z.string().trim().min(5).max(300) });

@Controller('certificados')
export class CertificadosController {
  constructor(private readonly certificados: CertificadosService) {}

  @Post()
  @Can(CertificadosPolicy, 'usar')
  emitir(@CurrentUser() u: UsuarioAutenticado, @Body({ schema: emitirSchema }) body: z.infer<typeof emitirSchema>, @Ip() ip: string) {
    return this.certificados.emitir(u, body.trabajadorId ?? u.trabajadorId, ip);
  }

  @Get('mios')
  @Can(CertificadosPolicy, 'usar')
  mios(@CurrentUser() u: UsuarioAutenticado) {
    return this.certificados.listar(u, u.trabajadorId);
  }

  @Get('trabajador/:id')
  @Can(CertificadosPolicy, 'usar')
  deTrabajador(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.certificados.listar(u, id);
  }

  @Get(':id/pdf')
  @Can(CertificadosPolicy, 'usar')
  async pdf(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { bytes, nombre } = await this.certificados.pdf(u, id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${nombre}"`, 'Cache-Control': 'no-store' }).send(bytes);
  }

  @Post(':id/revocar')
  @Can(CertificadosPolicy, 'gestionar')
  @HttpCode(204)
  revocar(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: revocarSchema }) body: z.infer<typeof revocarSchema>, @Ip() ip: string) {
    return this.certificados.revocar(u, id, body.motivo, ip);
  }

  /** Pública: la usa un tercero sin cuenta. Límite estricto para impedir probar códigos al azar. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('verificar/:codigo')
  verificar(@Param('codigo') codigo: string, @Ip() ip: string) {
    return this.certificados.verificar(codigo.slice(0, 20), ip);
  }
}

@Module({
  imports: [AuditoriaModule],
  controllers: [CertificadosController],
  providers: [CertificadosPolicy, CertificadosService],
})
export class CertificadosModule {}
