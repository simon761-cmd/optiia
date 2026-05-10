import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class InvoiceService {
  constructor(private prisma: PrismaService) {}

  async generateInvoicePdf(tenantId: string, saleId: string): Promise<Buffer> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        client: true,
        items: { include: { product: true } },
        store: true,
        tenant: true,
      },
    });

    if (!sale) throw new NotFoundException('Vente introuvable');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Facture ${sale.reference}`, Author: sale.tenant.name } });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ── En-tête ──────────────────────────────────────────────
      doc.fontSize(22).fillColor('#4f46e5').text(sale.tenant.name, 50, 50);

      doc
        .fontSize(9)
        .fillColor('#64748b')
        .text(sale.store?.addressLine1 ?? '', 50, 80)
        .text(`${sale.store?.postalCode ?? ''} ${sale.store?.city ?? ''}`.trim(), 50, 93)
        .text(sale.store?.phone ?? '', 50, 106)
        .text(sale.store?.email ?? '', 50, 119);

      doc.fontSize(20).fillColor('#0f172a').text('FACTURE', 400, 50, { align: 'right' });
      doc
        .fontSize(10)
        .fillColor('#64748b')
        .text(`N° ${sale.reference}`, 400, 78, { align: 'right' })
        .text(`Date : ${formatDate(sale.createdAt)}`, 400, 92, { align: 'right' });

      if (sale.status === 'DELIVERED' && sale.deliveredAt) {
        doc.text(`Livrée le : ${formatDate(sale.deliveredAt)}`, 400, 106, { align: 'right' });
      }

      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, 150).lineTo(545, 150).stroke();

      // ── Client ───────────────────────────────────────────────
      doc.fontSize(10).fillColor('#64748b').text('FACTURÉ À', 50, 170);
      doc.fontSize(11).fillColor('#0f172a').text(`${sale.client.firstName} ${sale.client.lastName}`, 50, 185);

      let yClient = 200;
      if ((sale.client as any).addressLine1) {
        doc.fontSize(9).fillColor('#475569').text((sale.client as any).addressLine1, 50, yClient);
        yClient += 13;
      }
      if ((sale.client as any).postalCode || (sale.client as any).city) {
        doc.text(`${(sale.client as any).postalCode ?? ''} ${(sale.client as any).city ?? ''}`.trim(), 50, yClient);
        yClient += 13;
      }
      if (sale.client.email) { doc.text(sale.client.email, 50, yClient); yClient += 13; }
      if (sale.client.phone) { doc.text(sale.client.phone, 50, yClient); }

      // ── Tableau articles ──────────────────────────────────────
      const tableTop = 280;

      doc.rect(50, tableTop, 495, 25).fillColor('#f1f5f9').fill();
      doc
        .fontSize(9)
        .fillColor('#475569')
        .text('Description', 60, tableTop + 9)
        .text('Qté', 350, tableTop + 9, { width: 40, align: 'center' })
        .text('PU HT', 395, tableTop + 9, { width: 60, align: 'right' })
        .text('Total TTC', 470, tableTop + 9, { width: 70, align: 'right' });

      let y = tableTop + 35;
      for (const item of sale.items) {
        const description =
          (item.product?.brand ? `${item.product.brand} — ` : '') +
          (item.product?.name ?? item.description);

        doc.fontSize(10).fillColor('#0f172a').text(description, 60, y, { width: 280 });

        if (item.product?.sku) {
          doc.fontSize(8).fillColor('#94a3b8').text(`SKU: ${item.product.sku}`, 60, y + 13);
        }

        doc
          .fontSize(10)
          .fillColor('#475569')
          .text(item.quantity.toString(), 350, y, { width: 40, align: 'center' })
          .text(`${Number(item.unitPriceHt).toFixed(2)} €`, 395, y, { width: 60, align: 'right' })
          .fillColor('#0f172a')
          .text(`${Number(item.totalTtc).toFixed(2)} €`, 470, y, { width: 70, align: 'right' });

        y += 30;
        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(50, y - 5).lineTo(545, y - 5).stroke();
      }

      // ── Totaux ────────────────────────────────────────────────
      y += 10;
      const totalsX = 350;
      const valuesX = 470;

      doc
        .fontSize(10)
        .fillColor('#475569')
        .text('Sous-total HT', totalsX, y, { width: 110, align: 'right' })
        .text(`${Number(sale.subtotalHt).toFixed(2)} €`, valuesX, y, { width: 70, align: 'right' });
      y += 18;

      doc
        .text('TVA', totalsX, y, { width: 110, align: 'right' })
        .text(`${Number(sale.vatAmount).toFixed(2)} €`, valuesX, y, { width: 70, align: 'right' });
      y += 22;

      doc.rect(totalsX - 5, y - 5, 200, 30).fillColor('#4f46e5').fill();
      doc
        .fontSize(11)
        .fillColor('#ffffff')
        .text('TOTAL TTC', totalsX, y + 5, { width: 110, align: 'right' })
        .fontSize(14)
        .text(`${Number(sale.totalTtc).toFixed(2)} €`, valuesX, y + 3, { width: 70, align: 'right' });

      // ── Statut ────────────────────────────────────────────────
      y += 50;
      const statusLabel = ({
        DELIVERED: '✓ Réglée',
        READY: 'Prête — en attente de retrait',
        PENDING: 'En cours de préparation',
        QUOTE: 'Devis (non engageant)',
      } as Record<string, string>)[sale.status] ?? sale.status;

      doc
        .fontSize(10)
        .fillColor(sale.status === 'DELIVERED' ? '#10b981' : '#f59e0b')
        .text(`Statut : ${statusLabel}`, 50, y);

      // ── Footer ────────────────────────────────────────────────
      const footerY = 750;
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, footerY - 10).lineTo(545, footerY - 10).stroke();
      doc
        .fontSize(8)
        .fillColor('#94a3b8')
        .text(`${sale.tenant.name} · Facture générée par OptiIA · ${formatDate(new Date())}`, 50, footerY, { width: 495, align: 'center' })
        .text('En cas de retard de paiement, indemnité forfaitaire pour frais de recouvrement de 40 €.', 50, footerY + 12, { width: 495, align: 'center' });

      doc.end();
    });
  }
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
