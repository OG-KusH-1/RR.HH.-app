/**
 * Almacén de archivos. Los módulos guardan y leen bytes a través de esta interfaz y no saben
 * dónde terminan: hoy en disco local, en producción en un bucket S3 privado
 * (fase de integraciones, posiblemente con @nestjs/storage). Cambiar de almacén = otro proveedor
 * del token ALMACEN, sin tocar el servicio de documentos.
 *
 * El almacén recibe bytes YA cifrados: aunque alguien obtenga acceso al disco o al bucket,
 * solo ve datos ilegibles. La clave vive en otro lugar (variable CLAVE_CIFRADO).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

export const ALMACEN = Symbol('ALMACEN');

export interface AlmacenArchivos {
  guardar(clave: string, datos: Buffer): Promise<void>;
  leer(clave: string): Promise<Buffer>;
}

export class AlmacenLocal implements AlmacenArchivos {
  private readonly raiz: string;

  constructor(directorio: string) {
    this.raiz = resolve(directorio);
  }

  /** Evita que una clave como "../../etc" escape de la carpeta del almacén. */
  private ruta(clave: string): string {
    const ruta = resolve(join(this.raiz, clave));
    if (!ruta.startsWith(this.raiz + sep)) throw new Error('Clave de almacén inválida');
    return ruta;
  }

  async guardar(clave: string, datos: Buffer): Promise<void> {
    const ruta = this.ruta(clave);
    await mkdir(dirname(ruta), { recursive: true });
    // 0o600: solo el usuario del proceso puede leer el archivo en el servidor.
    await writeFile(ruta, datos, { mode: 0o600 });
  }

  leer(clave: string): Promise<Buffer> {
    return readFile(this.ruta(clave));
  }
}
