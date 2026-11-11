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
import { empresas, registrosAuditoria, sedes, sesiones, trabajadores, usuarios, type Trabajador } from './schema.js';

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

async function main() {
  await db.delete(sesiones);
  await db.delete(registrosAuditoria);
  await db.delete(usuarios);
  await db.delete(trabajadores);
  await db.delete(sedes);
  await db.delete(empresas);

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
