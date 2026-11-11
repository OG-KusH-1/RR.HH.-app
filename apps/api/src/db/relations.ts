import { defineRelations } from 'drizzle-orm';
import * as schema from './schema.js';

export const relations = defineRelations(schema, (r) => ({
  sedes: { empresa: r.one.empresas({ from: r.sedes.empresaId, to: r.empresas.id }) },
  trabajadores: {
    sede: r.one.sedes({ from: r.trabajadores.sedeId, to: r.sedes.id }),
    usuario: r.one.usuarios({ from: r.trabajadores.id, to: r.usuarios.trabajadorId }),
  },
  usuarios: { trabajador: r.one.trabajadores({ from: r.usuarios.trabajadorId, to: r.trabajadores.id }) },
}));
