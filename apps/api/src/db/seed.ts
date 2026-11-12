/**
 * Datos de demostración: Comercial Te Moana SpA (empresa ficticia).
 * 52 trabajadores en 4 sedes y 4 usuarios de prueba con distintos roles.
 *
 * Uso: pnpm db:seed
 */
import { PasswordHasher } from '@nestjs/authentication';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { calcularDv } from '../common/rut.js';
import type { Rol } from '../common/roles.js';
import { TRAMOS_IMPUESTO_2026 } from '../previsional/liquidacion/tramos-impuesto.js';
import { createHash, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { calcularSaldo } from '../ausencias/saldo-vacaciones.js';
import { cifrar, claveDesdeBase64 } from '../common/cifrado.js';
import { generarPdf } from '../common/pdf.js';
import { AlmacenLocal } from '../documentos/almacen.js';
import { contarDiasHabiles } from '../ausencias/calendario-laboral.js';
import {
  afps,
  certificados,
  documentos,
  documentosRequeridos,
  empresas,
  feriados,
  indicadoresMensuales,
  institucionesSalud,
  invitaciones,
  movimientosVacaciones,
  notificaciones,
  registrosAuditoria,
  sedes,
  sesiones,
  solicitudesAusencia,
  solicitudesTitular,
  tasasAfp,
  tiposAusencia,
  tiposDocumento,
  trabajadores,
  usuarios,
  type Trabajador,
} from './schema.js';

const CLAVE_DEMO = 'Tangata2026!';

const db = drizzle(process.env.DATABASE_URL!);
const hasher = new PasswordHasher();

let correlativo = 12_400_000;
function rut(): string {
  correlativo += 137;
  const cuerpo = String(correlativo);
  return `${cuerpo}-${calcularDv(cuerpo)}`;
}

function fechaIngreso(indice: number): string {
  const anio = 2014 + (indice * 7) % 12;
  const mes = 1 + (indice * 5) % 12;
  const dia = 1 + (indice * 11) % 27;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

type Persona = [nombres: string, apellidos: string, cargo: string, rol?: Rol];

const plantel: Record<string, Persona[]> = {
  Administración: [
    ['Rodrigo', 'Pakarati Hey', 'Gerente general', 'GERENCIA'],
    ['Marcela', 'Tuki Riroroko', 'Encargada de personas', 'PERSONAS'],
    ['Felipe', 'Araya Soto', 'Jefe de finanzas', 'GERENCIA'],
    ['Ana', 'Hotus Teao', 'Asistente administrativa'],
    ['Javiera', 'Rojas Pont', 'Asistente contable'],
    ['Tomás', 'Atán Pate', 'Encargado de compras isla'],
    ['Daniela', 'Fuentes Icka', 'Asistente de personas'],
    ['Cristián', 'Edmunds Rapu', 'Soporte informático', 'ADMIN'],
  ],
  Distribuidora: [
    ['Mario', 'Haoa Tepano', 'Jefe de bodega', 'JEFATURA'],
    ['Kiko', 'Ika Pakomio', 'Bodeguero'],
    ['Luis', 'Paoa Teave', 'Bodeguero'],
    ['Héctor', 'Tepihe Nahoe', 'Bodeguero'],
    ['Juan', 'Hey Paoa', 'Chofer repartidor'],
    ['Pedro', 'Riroroko Tuki', 'Chofer repartidor'],
    ['Simón', 'Teao Haoa', 'Chofer repartidor'],
    ['Carlos', 'Muñoz Atán', 'Chofer repartidor'],
    ['Valentina', 'Pate Hotus', 'Vendedora en terreno'],
    ['Andrés', 'Rapu Ika', 'Vendedor en terreno'],
    ['Carolina', 'Nahoe Edmunds', 'Administrativa de bodega'],
    ['Ricardo', 'Pont Tepano', 'Bodeguero'],
    ['Matías', 'Icka Pakarati', 'Ayudante de reparto'],
    ['Sebastián', 'Tepano Hey', 'Ayudante de reparto'],
  ],
  'Minimarket Hanga Roa': [
    ['Josefina', 'Teave Paoa', 'Jefa de local', 'JEFATURA'],
    ['Camila', 'Hotus Rapu', 'Cajera', 'TRABAJADOR'],
    ['Fernanda', 'Pakomio Tuki', 'Cajera'],
    ['Ignacio', 'Haoa Pate', 'Cajero'],
    ['Paula', 'Riroroko Ika', 'Cajera'],
    ['Diego', 'Tepihe Teao', 'Reponedor'],
    ['Nicolás', 'Atán Hey', 'Reponedor'],
    ['Antonia', 'Rapu Nahoe', 'Reponedora'],
    ['Benjamín', 'Tuki Pont', 'Reponedor'],
    ['Constanza', 'Ika Teave', 'Cajera part-time'],
    ['Joaquín', 'Pate Haoa', 'Reponedor part-time'],
  ],
  'Minimarket Tahai': [
    ['Esteban', 'Pakarati Teao', 'Jefe de local', 'JEFATURA'],
    ['Francisca', 'Hey Riroroko', 'Cajera'],
    ['Catalina', 'Teao Pakomio', 'Cajera'],
    ['Vicente', 'Nahoe Tuki', 'Cajero'],
    ['Isidora', 'Paoa Hotus', 'Cajera'],
    ['Martín', 'Edmunds Ika', 'Reponedor'],
    ['Florencia', 'Tepano Rapu', 'Reponedora'],
    ['Agustín', 'Hotus Atán', 'Reponedor'],
    ['Trinidad', 'Icka Pate', 'Cajera part-time'],
    ['Lucas', 'Pont Haoa', 'Reponedor part-time'],
  ],
  'Bodega Santiago': [
    ['Gonzalo', 'Vergara Díaz', 'Jefe de operaciones Santiago', 'JEFATURA'],
    ['Patricio', 'González Pérez', 'Encargado de recepción'],
    ['Claudia', 'Muñoz Reyes', 'Compradora'],
    ['Jorge', 'Sepúlveda Castro', 'Operario de despacho'],
    ['Miguel', 'Contreras Silva', 'Operario de despacho'],
    ['Rocío', 'Torres Morales', 'Administrativa de embarques'],
    ['Álvaro', 'Herrera Lagos', 'Operario de recepción'],
    ['Bastián', 'Espinoza Vera', 'Operario de recepción'],
    ['Kevin', 'Ramírez Ortiz', 'Chofer'],
  ],
};

const definicionSedes = [
  { nombre: 'Administración', ciudad: 'Hanga Roa', zonaHoraria: 'Pacific/Easter' },
  { nombre: 'Distribuidora', ciudad: 'Hanga Roa', zonaHoraria: 'Pacific/Easter' },
  { nombre: 'Minimarket Hanga Roa', ciudad: 'Hanga Roa', zonaHoraria: 'Pacific/Easter' },
  { nombre: 'Minimarket Tahai', ciudad: 'Hanga Roa', zonaHoraria: 'Pacific/Easter' },
  { nombre: 'Bodega Santiago', ciudad: 'Santiago', zonaHoraria: 'America/Santiago' },
];

/** Usuarios de demostración con contraseña. El resto queda sin contraseña (pendiente de invitación). */
const usuariosDemo = new Set(['Rodrigo', 'Marcela', 'Josefina', 'Camila']);

/**
 * Comisiones AFP vigentes según la Superintendencia de Pensiones (consultado el 11-11-2026).
 * AFP Uno bajó a 0,46 % el 1 de octubre de 2025.
 */
const FUENTE_AFP = 'Superintendencia de Pensiones, spensiones.cl, consultado 2026-11-11';
const AFPS: [codigo: string, nombre: string, comision: number][] = [
  ['CAPITAL', 'Capital', 1.44],
  ['CUPRUM', 'Cuprum', 1.44],
  ['HABITAT', 'Habitat', 1.27],
  ['MODELO', 'Modelo', 0.58],
  ['PLANVITAL', 'PlanVital', 1.16],
  ['PROVIDA', 'Provida', 1.45],
  ['UNO', 'Uno', 0.46],
];

const SALUD: [codigo: string, nombre: string, tipo: 'FONASA' | 'ISAPRE'][] = [
  ['FONASA', 'Fonasa', 'FONASA'],
  ['BANMEDICA', 'Isapre Banmédica', 'ISAPRE'],
  ['COLMENA', 'Isapre Colmena', 'ISAPRE'],
  ['CONSALUD', 'Isapre Consalud', 'ISAPRE'],
  ['CRUZBLANCA', 'Isapre Cruz Blanca', 'ISAPRE'],
  ['ESENCIAL', 'Isapre Esencial', 'ISAPRE'],
  ['NUEVAMASVIDA', 'Isapre Nueva Masvida', 'ISAPRE'],
  ['VIDATRES', 'Isapre Vida Tres', 'ISAPRE'],
];

/** Sueldo base de referencia por cargo (supuesto de la empresa ficticia, en pesos). */
function sueldoPorCargo(cargo: string): number {
  if (cargo.startsWith('Gerente')) return 3_800_000;
  if (cargo.startsWith('Jefe de finanzas')) return 2_600_000;
  if (cargo.startsWith('Jefe') || cargo.startsWith('Jefa')) return 1_450_000;
  if (cargo.startsWith('Encargad')) return 1_200_000;
  if (cargo.includes('part-time')) return 420_000;
  if (cargo.startsWith('Chofer') || cargo.startsWith('Vendedor') || cargo.startsWith('Soporte') || cargo.startsWith('Compradora')) return 850_000;
  if (cargo.startsWith('Asistente') || cargo.startsWith('Administrativa')) return 780_000;
  return 620_000;
}

/** Tasas del empleador vigentes desde agosto de 2026, con sus fuentes. Se verifican cada mes contra Previred. */
const BASE_INDICADORES = {
  ingresoMinimo: 553_553,
  topeImponibleAfpUf: 90,
  topeImponibleCesantiaUf: 135.2,
  tasaSis: 1.78,
  tasaEmpleadorReforma: 3.5,
  tasaAccidentes: 0.93,
  tramosImpuesto: TRAMOS_IMPUESTO_2026,
};
const fuente = (texto: string) => ({ fuente: texto, consultadoEn: '2026-11-11T21:00:00.000Z' });
const FUENTES_BASE = {
  ingresoMinimo: fuente('Ley 21.830, desde mayo de 2026'),
  topes: fuente('Superintendencia de Pensiones: 90 UF y 135,2 UF desde febrero de 2026'),
  tasaSis: fuente('Tasa SIS de agosto a octubre de 2026 (AFP Habitat, folleto N°17). Verificar la de noviembre en Previred'),
  tasaEmpleadorReforma: fuente('Ley 21.735: 3,5 % de agosto de 2026 a julio de 2027'),
  tasaAccidentes: fuente('Cotización básica 0,90 % + Ley SANNA 0,03 %; sin cotización adicional por riesgo'),
  tramosImpuesto: fuente('SII, impuesto único de segunda categoría, tramos en UTM'),
};

/** Fecha de referencia de la demostración: los saldos históricos se calculan a este día. */
const HOY_DEMO = '2026-11-12';

/**
 * Feriados nacionales 2026 y 2027 (Ley 2.977 y modificaciones). Los de 2027 se contrastaron
 * con el calendario publicado por Buk el 16-10-2026. Personas puede corregirlos desde la aplicación.
 */
const FUENTE_FERIADOS = 'Ley 2.977 y modificaciones; calendario 2027 contrastado con buk.cl (16-10-2026). Verificar en feriados.cl';
const FERIADOS: [fecha: string, nombre: string, irrenunciable?: boolean][] = [
  ['2026-01-01', 'Año Nuevo', true],
  ['2026-04-03', 'Viernes Santo'],
  ['2026-04-04', 'Sábado Santo'],
  ['2026-05-01', 'Día Nacional del Trabajo', true],
  ['2026-05-21', 'Día de las Glorias Navales'],
  ['2026-06-21', 'Día Nacional de los Pueblos Indígenas'],
  ['2026-06-29', 'San Pedro y San Pablo'],
  ['2026-07-16', 'Día de la Virgen del Carmen'],
  ['2026-08-15', 'Asunción de la Virgen'],
  ['2026-09-18', 'Independencia Nacional', true],
  ['2026-09-19', 'Día de las Glorias del Ejército', true],
  ['2026-10-12', 'Encuentro de Dos Mundos'],
  ['2026-10-31', 'Día de las Iglesias Evangélicas y Protestantes'],
  ['2026-11-01', 'Día de Todos los Santos'],
  ['2026-12-08', 'Inmaculada Concepción'],
  ['2026-12-25', 'Navidad', true],
  ['2027-01-01', 'Año Nuevo', true],
  ['2027-03-26', 'Viernes Santo'],
  ['2027-03-27', 'Sábado Santo'],
  ['2027-05-01', 'Día Nacional del Trabajo', true],
  ['2027-05-21', 'Día de las Glorias Navales'],
  ['2027-06-21', 'Día Nacional de los Pueblos Indígenas'],
  ['2027-06-28', 'San Pedro y San Pablo'],
  ['2027-07-16', 'Día de la Virgen del Carmen'],
  ['2027-08-15', 'Asunción de la Virgen'],
  ['2027-09-17', 'Fiestas Patrias (feriado adicional)'],
  ['2027-09-18', 'Independencia Nacional', true],
  ['2027-09-19', 'Día de las Glorias del Ejército', true],
  ['2027-10-11', 'Encuentro de Dos Mundos'],
  ['2027-10-31', 'Día de las Iglesias Evangélicas y Protestantes'],
  ['2027-11-01', 'Día de Todos los Santos'],
  ['2027-12-08', 'Inmaculada Concepción'],
  ['2027-12-25', 'Navidad', true],
];

const TIPOS_AUSENCIA = [
  { codigo: 'VACACIONES', nombre: 'Vacaciones', descripcion: 'Feriado legal: 15 días hábiles por año, más el progresivo (arts. 67 y 68 del Código del Trabajo).', afectaSaldo: true, conGoce: true, sensible: false, requiereAprobacion: true, permiteRetroactivo: false },
  { codigo: 'PERMISO_CON_GOCE', nombre: 'Permiso con goce de sueldo', descripcion: 'Permiso pactado con la empresa que no descuenta remuneración.', afectaSaldo: false, conGoce: true, sensible: false, requiereAprobacion: true, permiteRetroactivo: false },
  { codigo: 'PERMISO_SIN_GOCE', nombre: 'Permiso sin goce de sueldo', descripcion: 'Permiso pactado que se descuenta de la remuneración del mes.', afectaSaldo: false, conGoce: false, sensible: false, requiereAprobacion: true, permiteRetroactivo: false },
  { codigo: 'PERMISO_LEGAL', nombre: 'Permiso legal', descripcion: 'Nacimiento, matrimonio o fallecimiento de un familiar, según el Código del Trabajo. Personas revisa el respaldo.', afectaSaldo: false, conGoce: true, sensible: false, requiereAprobacion: true, permiteRetroactivo: true },
  { codigo: 'LICENCIA_MEDICA', nombre: 'Licencia médica', descripcion: 'Se informa, no se aprueba. El folio y el diagnóstico solo los ve Personas.', afectaSaldo: false, conGoce: true, sensible: true, requiereAprobacion: false, permiteRetroactivo: true },
];

async function main() {
  // Orden inverso a las claves foráneas.
  await db.delete(notificaciones);
  await db.delete(movimientosVacaciones);
  await db.delete(solicitudesAusencia);
  await db.delete(tiposAusencia);
  await db.delete(feriados);
  await db.delete(certificados);
  await db.delete(documentos);
  await db.delete(documentosRequeridos);
  await db.delete(tiposDocumento);
  await db.delete(solicitudesTitular);
  await db.delete(invitaciones);
  await db.delete(indicadoresMensuales);
  await db.delete(sesiones);
  await db.delete(registrosAuditoria);
  await db.delete(usuarios);
  await db.delete(trabajadores);
  await db.delete(sedes);
  await db.delete(empresas);
  await db.delete(tasasAfp);
  await db.delete(afps);
  await db.delete(institucionesSalud);

  const listaAfp = await db.insert(afps).values(AFPS.map(([codigo, nombre]) => ({ codigo, nombre }))).returning();
  await db.insert(tasasAfp).values(
    AFPS.map(([codigo, , comision]) => ({ afpId: listaAfp.find((a) => a.codigo === codigo)!.id, vigenteDesde: '2025-10-01', comision, fuente: FUENTE_AFP })),
  );
  const listaSalud = await db.insert(institucionesSalud).values(SALUD.map(([codigo, nombre, tipo]) => ({ codigo, nombre, tipo }))).returning();

  // Octubre confirmado (para poder calcular de inmediato) y noviembre en borrador (para practicar la confirmación).
  await db.insert(indicadoresMensuales).values([
    {
      periodo: '2026-10',
      estado: 'CONFIRMADO',
      uf: 41_065.38,
      utm: 72_151,
      ...BASE_INDICADORES,
      fuentes: { ...FUENTES_BASE, uf: fuente('SII: UF al 01-11-2026, usada como referencia del cierre de octubre'), utm: fuente('SII, UTM de octubre de 2026') },
      confirmadoEn: new Date('2026-11-02T12:00:00Z'),
    },
    {
      periodo: '2026-11',
      estado: 'BORRADOR',
      uf: 41_274.2,
      utm: 72_440,
      ...BASE_INDICADORES,
      fuentes: { ...FUENTES_BASE, uf: fuente('SII: UF al 05-11-2026; se actualiza al sincronizar'), utm: fuente('SII, UTM de noviembre de 2026') },
    },
  ]);

  const [empresa] = await db
    .insert(empresas)
    .values({ rut: '76543210-3', razonSocial: 'Comercial Te Moana SpA', nombreFantasia: 'Te Moana' })
    .returning();

  const hashDemo = await hasher.hash(CLAVE_DEMO);
  const demo: string[] = [];
  let indice = 0;
  let gerenteId: string | undefined;

  for (const def of definicionSedes) {
    const [sede] = await db.insert(sedes).values({ ...def, empresaId: empresa.id }).returning();
    let jefaturaId: string | null = null as string | null;

    for (const [nombres, apellidos, cargo, rol] of plantel[def.nombre]) {
      indice++;
      const rutTrabajador = rut();
      const [t]: Trabajador[] = await db
        .insert(trabajadores)
        .values({
          empresaId: empresa.id,
          sedeId: sede.id,
          // El jefe de cada sede reporta al gerente; el resto, a su jefe de sede.
          jefaturaId: rol === 'JEFATURA' || rol === 'GERENCIA' ? (gerenteId ?? null) : (jefaturaId ?? gerenteId ?? null),
          rut: rutTrabajador,
          nombres,
          apellidos,
          cargo,
          fechaIngreso: fechaIngreso(indice),
          tipoContrato: cargo.includes('part-time') || indice % 9 === 0 ? 'PLAZO_FIJO' : 'INDEFINIDO',
          horasSemanales: cargo.includes('part-time') ? 30 : 42,
          telefono: `+56 9 ${String(50000000 + indice * 7919).slice(0, 4)} ${String(indice * 3571).padStart(4, '0').slice(-4)}`,
          sueldoBase: sueldoPorCargo(cargo),
          // Distribución variada para probar todas las AFP y ambos sistemas de salud.
          afpId: listaAfp[indice % listaAfp.length].id,
          saludId: indice % 4 === 0 ? listaSalud[1 + (indice % (listaSalud.length - 1))].id : listaSalud[0].id,
          planIsapreUf: indice % 4 === 0 ? 2.5 + (indice % 5) * 0.5 : null,
        })
        .returning();

      if (rol === 'GERENCIA' && !gerenteId) gerenteId = t.id;
      if (rol === 'JEFATURA') jefaturaId = t.id;

      const tieneClave = usuariosDemo.has(nombres);
      await db.insert(usuarios).values({ trabajadorId: t.id, rol: rol ?? 'TRABAJADOR', hashClave: tieneClave ? hashDemo : null });
      if (tieneClave) demo.push(`  ${(rol ?? 'TRABAJADOR').padEnd(10)} ${rutTrabajador.padEnd(11)} ${nombres} ${apellidos} (${cargo})`);
    }
  }

  await sembrarAusencias(empresa.id);
  await sembrarDocumentos(empresa.id);

  console.log(`Empresa: ${empresa.razonSocial}, ${indice} trabajadores.\n`);
  console.log(`Usuarios de demostración (contraseña: ${CLAVE_DEMO}):`);
  console.log(demo.join('\n'));
  process.exit(0);
}

/**
 * Saldos históricos realistas y solicitudes de ejemplo para practicar la aprobación.
 * El escenario principal está en el Minimarket Hanga Roa (jefa: Josefina Teave):
 * Camila tiene una solicitud pendiente que se cruza con vacaciones ya aprobadas de Fernanda.
 */
async function sembrarAusencias(empresaId: string) {
  await db.insert(feriados).values(FERIADOS.map(([fecha, nombre, irrenunciable]) => ({ fecha, nombre, irrenunciable: irrenunciable ?? false, fuente: FUENTE_FERIADOS })));
  const tipos = await db.insert(tiposAusencia).values(TIPOS_AUSENCIA).returning();
  const tipo = (codigo: string) => tipos.find((t) => t.codigo === codigo)!;
  const setFeriados = new Set(FERIADOS.map(([f]) => f));

  const lista = await db.select().from(trabajadores).where(eq(trabajadores.empresaId, empresaId));
  const porNombre = (n: string) => lista.find((t) => t.nombres === n)!;

  // Días ya tomados antes de usar Tangata, para que cada persona quede con un saldo distinto y creíble.
  const historicos = lista.flatMap((t, i) => {
    const s = calcularSaldo({ fechaIngreso: t.fechaIngreso, aniosPrevios: 0, fechaCorte: HOY_DEMO, movimientos: 0 });
    if (s.mesesServicio < 12) return [];
    // Camila queda con saldo suficiente para su solicitud pendiente del escenario de demostración.
    const objetivo = t.nombres === 'Camila' ? 13.5 : Math.min(s.devengado, 5 + ((i * 7) % 20) + (i % 3) * 0.75);
    const tomados = Math.round((s.devengado - objetivo) * 100) / 100;
    return tomados > 0 ? [{ trabajadorId: t.id, fecha: '2026-10-31', tipo: 'TOMADO_ANTERIOR' as const, dias: -tomados, motivo: 'Días tomados antes de Tangata, según planilla de Personas al 31-10-2026' }] : [];
  });
  if (historicos.length) await db.insert(movimientosVacaciones).values(historicos);

  const [josefina] = await db.select().from(usuarios).where(eq(usuarios.trabajadorId, porNombre('Josefina').id));
  const [marcela] = await db.select().from(usuarios).where(eq(usuarios.trabajadorId, porNombre('Marcela').id));

  const ejemplos: { nombre: string; codigo: string; desde: string; hasta: string; estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'; comentario?: string; reservado?: string; motivo?: string }[] = [
    { nombre: 'Camila', codigo: 'VACACIONES', desde: '2026-12-21', hasta: '2026-12-31', estado: 'PENDIENTE', comentario: 'Viajo al continente a ver a mi familia.' },
    { nombre: 'Fernanda', codigo: 'VACACIONES', desde: '2026-12-28', hasta: '2027-01-08', estado: 'APROBADA' },
    { nombre: 'Ignacio', codigo: 'PERMISO_CON_GOCE', desde: '2026-11-20', hasta: '2026-11-20', estado: 'PENDIENTE', comentario: 'Trámite en el registro civil.' },
    { nombre: 'Diego', codigo: 'LICENCIA_MEDICA', desde: '2026-11-09', hasta: '2026-11-15', estado: 'APROBADA', reservado: 'Folio 4471-2296. Reposo total por lumbago.' },
    { nombre: 'Paula', codigo: 'VACACIONES', desde: '2026-10-05', hasta: '2026-10-09', estado: 'APROBADA' },
    { nombre: 'Antonia', codigo: 'VACACIONES', desde: '2026-12-14', hasta: '2026-12-18', estado: 'RECHAZADA', motivo: 'Semana de inventario anual; podemos verlo para enero.' },
    { nombre: 'Kiko', codigo: 'VACACIONES', desde: '2026-11-23', hasta: '2026-11-27', estado: 'APROBADA' },
    { nombre: 'Juan', codigo: 'VACACIONES', desde: '2026-11-30', hasta: '2026-12-11', estado: 'PENDIENTE' },
    { nombre: 'Francisca', codigo: 'VACACIONES', desde: '2027-01-04', hasta: '2027-01-15', estado: 'APROBADA' },
    { nombre: 'Jorge', codigo: 'PERMISO_LEGAL', desde: '2026-11-16', hasta: '2026-11-20', estado: 'APROBADA', comentario: 'Nacimiento de mi hija.' },
    { nombre: 'Rocío', codigo: 'VACACIONES', desde: '2026-12-01', hasta: '2026-12-04', estado: 'PENDIENTE' },
  ];

  for (const e of ejemplos) {
    const t = porNombre(e.nombre);
    const dias = contarDiasHabiles(e.desde, e.hasta, setFeriados);
    const resuelta = e.estado !== 'PENDIENTE';
    const resolvedor = t.sedeId === porNombre('Josefina').sedeId ? josefina.id : marcela.id;
    const [s] = await db
      .insert(solicitudesAusencia)
      .values({
        empresaId,
        trabajadorId: t.id,
        tipoId: tipo(e.codigo).id,
        desde: e.desde,
        hasta: e.hasta,
        diasHabiles: dias,
        estado: e.estado,
        comentario: e.comentario ?? null,
        detalleReservado: e.reservado ?? null,
        motivoRechazo: e.motivo ?? null,
        resueltaPor: resuelta ? resolvedor : null,
        resueltaEn: resuelta ? new Date('2026-11-05T15:00:00Z') : null,
      })
      .returning();
    if (e.estado === 'APROBADA' && e.codigo === 'VACACIONES') {
      await db.insert(movimientosVacaciones).values({ trabajadorId: t.id, fecha: e.desde, tipo: 'TOMADO', dias: -dias, solicitudId: s.id, motivo: `Vacaciones del ${e.desde} al ${e.hasta}` });
    }
    if (e.estado === 'PENDIENTE') {
      await db.insert(notificaciones).values({
        empresaId,
        trabajadorId: t.jefaturaId!,
        tipo: 'SOLICITUD_PENDIENTE',
        titulo: `${t.nombres} ${t.apellidos.split(' ')[0]} pide ${tipo(e.codigo).nombre.toLowerCase()}`,
        mensaje: `Del ${e.desde} al ${e.hasta}.`,
        enlace: `/ausencias/${s.id}`,
      });
    }
  }
}

const TIPOS_DOCUMENTO = [
  { codigo: 'CONTRATO', nombre: 'Contrato de trabajo', conVencimiento: false, visibilidadPorDefecto: 'TRABAJADOR' as const },
  { codigo: 'ANEXO', nombre: 'Anexo de contrato', conVencimiento: false, visibilidadPorDefecto: 'TRABAJADOR' as const },
  { codigo: 'CEDULA', nombre: 'Cédula de identidad', conVencimiento: true, visibilidadPorDefecto: 'TRABAJADOR' as const },
  { codigo: 'CERT_AFP', nombre: 'Certificado de afiliación AFP', conVencimiento: false, visibilidadPorDefecto: 'TRABAJADOR' as const },
  { codigo: 'CERT_SALUD', nombre: 'Certificado de Fonasa o Isapre', conVencimiento: false, visibilidadPorDefecto: 'TRABAJADOR' as const },
  { codigo: 'LICENCIA_CONDUCIR', nombre: 'Licencia de conducir', conVencimiento: true, visibilidadPorDefecto: 'TRABAJADOR' as const },
  { codigo: 'EXAMEN_SALUD', nombre: 'Examen de salud ocupacional', conVencimiento: true, visibilidadPorDefecto: 'RESERVADO' as const },
  { codigo: 'REGLAMENTO', nombre: 'Recepción del reglamento interno', conVencimiento: false, visibilidadPorDefecto: 'TRABAJADOR' as const },
  { codigo: 'LICENCIA_MEDICA', nombre: 'Licencia médica', conVencimiento: false, visibilidadPorDefecto: 'RESERVADO' as const },
  { codigo: 'OTRO', nombre: 'Otro documento', conVencimiento: false, visibilidadPorDefecto: 'INTERNO' as const },
];

/**
 * Carpetas digitales de ejemplo: PDF reales, cifrados como en producción.
 * A propósito quedan carpetas incompletas y documentos por vencer, para que el reporte de
 * faltantes y los avisos tengan algo que mostrar.
 */
async function sembrarDocumentos(empresaId: string) {
  const clave = claveDesdeBase64(process.env.CLAVE_CIFRADO!);
  const dir = process.env.ALMACEN_DIR ?? 'almacen';
  // El seed borra la base completa; sin esto quedarían archivos cifrados huérfanos en el almacén.
  if (process.env.NODE_ENV === 'production') throw new Error('El seed de demostración no se ejecuta en producción.');
  await rm(dir, { recursive: true, force: true });
  const almacen = new AlmacenLocal(dir);
  const tipos = await db.insert(tiposDocumento).values(TIPOS_DOCUMENTO).returning();
  const tipo = (c: string) => tipos.find((t) => t.codigo === c)!;
  await db.insert(documentosRequeridos).values([
    ...['CONTRATO', 'CEDULA', 'CERT_AFP', 'CERT_SALUD', 'REGLAMENTO'].map((c) => ({ empresaId, cargo: '*', tipoId: tipo(c).id })),
    ...['Chofer repartidor', 'Chofer'].map((cargo) => ({ empresaId, cargo, tipoId: tipo('LICENCIA_CONDUCIR').id })),
    ...['Bodeguero', 'Operario de despacho', 'Operario de recepción'].map((cargo) => ({ empresaId, cargo, tipoId: tipo('EXAMEN_SALUD').id })),
  ]);

  const lista = await db.select().from(trabajadores).where(eq(trabajadores.empresaId, empresaId)).orderBy(trabajadores.rut);
  const filas: (typeof documentos.$inferInsert)[] = [];
  const mas = (dias: number) => new Date(Date.UTC(2026, 10, 12 + dias)).toISOString().slice(0, 10);

  async function agregar(t: Trabajador, codigo: string, venceEl: string | null = null) {
    const ti = tipo(codigo);
    const pdf = await generarPdf({
      encabezado: 'Comercial Te Moana SpA',
      subencabezado: 'Documento de demostración generado por Tangata',
      titulo: ti.nombre,
      parrafos: [`Documento ficticio de ${t.nombres} ${t.apellidos}, ${t.cargo}.`, 'Este archivo existe para mostrar la carpeta digital, el cifrado y los avisos de vencimiento.'],
      datos: [['RUT', t.rut], ['Fecha de ingreso', t.fechaIngreso], ...(venceEl ? ([['Vence', venceEl]] as [string, string][]) : [])],
    });
    const claveAlmacen = `${empresaId}/${randomUUID()}`;
    await almacen.guardar(claveAlmacen, cifrar(pdf, clave));
    filas.push({
      empresaId,
      trabajadorId: t.id,
      tipoId: ti.id,
      nombreArchivo: `${ti.codigo.toLowerCase()}-${t.apellidos.split(' ')[0].toLowerCase()}.pdf`,
      mime: 'application/pdf',
      tamano: pdf.length,
      claveAlmacen,
      sha256: createHash('sha256').update(pdf).digest('hex'),
      venceEl,
      visibilidad: ti.visibilidadPorDefecto,
    });
  }

  for (const [i, t] of lista.entries()) {
    if (i % 11 !== 5) await agregar(t, 'CONTRATO');
    if (i % 6 !== 2) await agregar(t, 'CEDULA', mas(200 + i * 37));
    if (i % 5 !== 1) await agregar(t, 'CERT_AFP');
    if (i % 4 !== 3) await agregar(t, 'CERT_SALUD');
    if (i % 3 !== 0) await agregar(t, 'REGLAMENTO');
    if (t.cargo.startsWith('Chofer')) await agregar(t, 'LICENCIA_CONDUCIR', mas([12, 27, -3, 140, 400][i % 5]));
    if (['Bodeguero', 'Operario de despacho'].includes(t.cargo) && i % 2 === 0) await agregar(t, 'EXAMEN_SALUD', mas([4, 45, 300][i % 3]));
  }
  await db.insert(documentos).values(filas);

  // Contratos a plazo fijo con fecha de término: algunos vencen pronto y requieren decisión.
  const plazoFijo = lista.filter((t) => t.tipoContrato === 'PLAZO_FIJO');
  for (const [i, t] of plazoFijo.entries()) {
    await db.update(trabajadores).set({ fechaTerminoContrato: mas([9, 24, 52, 95, 160][i % 5]) }).where(eq(trabajadores.id, t.id));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
