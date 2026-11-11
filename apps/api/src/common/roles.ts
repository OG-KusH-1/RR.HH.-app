export const ROLES = ['TRABAJADOR', 'JEFATURA', 'PERSONAS', 'GERENCIA', 'ADMIN'] as const;
export type Rol = (typeof ROLES)[number];
