/**
 * Datos de demostración: Comercial Te Moana SpA (empresa ficticia).
 * 52 trabajadores en 4 sedes y 4 usuarios de prueba con distintos roles.
 *
 * Uso: pnpm db:seed
 */
import { PasswordHasher } from '@nestjs/authentication';
import { drizzle } from 'drizzle-orm/node-postgres';
import { calcularDv } from '../common/rut.js';
import type { Rol } from '../common/roles.js';
import { TRAMOS_IMPUESTO_2026 } from '../previsional/liquidacion/tramos-impuesto.js';
import { afps, empresas, indicadoresMensuales, institucionesSalud, registrosAuditoria, sedes, sesiones, tasasAfp, trabajadores, usuarios, type Trabajador } from './schema.js';

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

async function main() {
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

  console.log(`Empresa: ${empresa.razonSocial}, ${indice} trabajadores.\n`);
  console.log(`Usuarios de demostración (contraseña: ${CLAVE_DEMO}):`);
  console.log(demo.join('\n'));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
