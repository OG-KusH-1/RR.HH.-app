import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { Rol } from '../common/roles.js';
import { alcanceListado, puedeVerFicha, puedeVerResumenEmpresa } from './alcance.js';

const EMPRESA = 'empresa-1';

function usuario(rol: Rol, trabajadorId = 'yo'): UsuarioAutenticado {
  return { id: 'u', trabajadorId, empresaId: EMPRESA, sedeId: 's', rol, rut: '1-9', nombres: 'A', apellidos: 'B', cargo: 'C' };
}

const propia = { id: 'yo', empresaId: EMPRESA, jefaturaId: 'jefe' };
const deMiEquipo = { id: 'otro', empresaId: EMPRESA, jefaturaId: 'yo' };
const deOtroEquipo = { id: 'otro', empresaId: EMPRESA, jefaturaId: 'jefe' };
const deOtraEmpresa = { id: 'otro', empresaId: 'empresa-2', jefaturaId: null };

describe('Visibilidad de fichas', () => {
  it('un trabajador ve solo su ficha', () => {
    expect(puedeVerFicha(usuario('TRABAJADOR'), propia)).toBe(true);
    expect(puedeVerFicha(usuario('TRABAJADOR'), deOtroEquipo)).toBe(false);
    expect(alcanceListado(usuario('TRABAJADOR'))).toEqual({ tipo: 'propio' });
  });

  it('una jefatura ve a su equipo directo y no a otros', () => {
    expect(puedeVerFicha(usuario('JEFATURA'), deMiEquipo)).toBe(true);
    expect(puedeVerFicha(usuario('JEFATURA'), deOtroEquipo)).toBe(false);
    expect(alcanceListado(usuario('JEFATURA'))).toEqual({ tipo: 'equipo', jefaturaId: 'yo' });
  });

  it.each(['PERSONAS', 'GERENCIA', 'ADMIN'] as const)('%s ve toda la empresa', (rol) => {
    expect(puedeVerFicha(usuario(rol), deOtroEquipo)).toBe(true);
    expect(alcanceListado(usuario(rol))).toEqual({ tipo: 'empresa' });
    expect(puedeVerResumenEmpresa(usuario(rol))).toBe(true);
  });

  it.each(['TRABAJADOR', 'JEFATURA', 'PERSONAS', 'GERENCIA', 'ADMIN'] as const)('%s nunca ve otra empresa', (rol) => {
    expect(puedeVerFicha(usuario(rol), deOtraEmpresa)).toBe(false);
  });

  it('trabajadores y jefaturas no ven el resumen de la empresa', () => {
    expect(puedeVerResumenEmpresa(usuario('TRABAJADOR'))).toBe(false);
    expect(puedeVerResumenEmpresa(usuario('JEFATURA'))).toBe(false);
  });
});
