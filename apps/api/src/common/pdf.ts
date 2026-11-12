/**
 * Generación de PDF simples con la identidad de la empresa. Se usa para certificados (HU-18)
 * y para los documentos de demostración del seed.
 *
 * pdfkit trabaja con fuentes estándar (Helvetica) que cubren tildes y eñes del español.
 * Si más adelante se necesita la tipografía del portal, se embebe un .ttf con `doc.font(ruta)`.
 */
import PDFDocument from 'pdfkit';

export interface ContenidoPdf {
  encabezado: string;
  subencabezado?: string;
  titulo: string;
  parrafos: string[];
  /** Pares etiqueta-valor que se imprimen como tabla simple. */
  datos?: [string, string][];
  firma?: string[];
  pie?: string;
  /** PNG (por ejemplo, un código QR) que se dibuja en la esquina inferior derecha. */
  imagen?: Buffer;
}

const MOANA = '#0b5563';
const BASALTO = '#23302f';
const SUAVE = '#56625f';

export function generarPdf(c: ContenidoPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 64, bottom: 64, left: 72, right: 72 }, info: { Title: c.titulo, Producer: 'Tangata' } });
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    doc.fillColor(MOANA).font('Helvetica-Bold').fontSize(14).text(c.encabezado);
    if (c.subencabezado) doc.fillColor(SUAVE).font('Helvetica').fontSize(9.5).text(c.subencabezado);
    doc.moveTo(72, doc.y + 10).lineTo(540, doc.y + 10).strokeColor(MOANA).lineWidth(1.2).stroke();
    doc.moveDown(2.5);

    doc.fillColor(BASALTO).font('Helvetica-Bold').fontSize(18).text(c.titulo, { align: 'center' });
    doc.moveDown(1.5);
    doc.font('Helvetica').fontSize(11.5);
    for (const p of c.parrafos) {
      doc.text(p, { align: 'justify', lineGap: 3 });
      doc.moveDown(0.8);
    }

    if (c.datos?.length) {
      doc.moveDown(0.4);
      for (const [k, v] of c.datos) {
        const y = doc.y;
        doc.fillColor(SUAVE).font('Helvetica').fontSize(10.5).text(k, 90, y, { width: 170 });
        doc.fillColor(BASALTO).font('Helvetica-Bold').text(v, 270, y, { width: 270 });
        doc.moveDown(0.5);
      }
      doc.x = 72;
      doc.moveDown(1);
    }

    if (c.firma?.length) {
      doc.moveDown(3);
      doc.moveTo(220, doc.y).lineTo(392, doc.y).strokeColor(SUAVE).lineWidth(0.6).stroke();
      doc.moveDown(0.4);
      doc.fillColor(BASALTO).font('Helvetica').fontSize(10.5);
      for (const linea of c.firma) doc.text(linea, 72, doc.y, { align: 'center', width: 468 });
    }

    if (c.imagen) doc.image(c.imagen, 452, 640, { width: 88 });
    if (c.pie) doc.fillColor(SUAVE).font('Helvetica').fontSize(8.5).text(c.pie, 72, 650, { width: c.imagen ? 360 : 468 });
    doc.end();
  });
}
