import * as XLSX from 'xlsx';

/**
 * Generates and triggers download of the Official Telkom Excel Request Template (.xlsx)
 * pre-configured for the 63.5 x 38.1 mm Physical Field Sticker layout.
 */
export function downloadStandardLabelExcelTemplate() {
  const sampleData = [
    {
      'Hostname': '0208-D5-SBY-IDM-T312',
      'Order SDWAN': 'ORD-2026-SUB-001',
      'Kota': 'SURABAYA',
      'No Pengadaan': 'K.TEL.000882/HK.810/GPP-000000/2026',
      'Serial Number': 'FGT60FTK21049281',
      'Customer': 'INDOMARET',
      'Campaign': 'Batch 4 Rollout',
    },
    {
      'Hostname': '0201-D3-BDG-BMRI-KCP01',
      'Order SDWAN': 'ORD-2026-BDG-084',
      'Kota': 'BANDUNG',
      'No Pengadaan': 'K.TEL.000882/HK.810/GPP-000000/2026',
      'Serial Number': 'FGT60FTK21038192',
      'Customer': 'BANK MANDIRI',
      'Campaign': 'Batch 4 Rollout',
    },
    {
      'Hostname': '0204-D7-MKS-BPJS-CAB02',
      'Order SDWAN': 'ORD-2026-MKS-012',
      'Kota': 'MAKASSAR',
      'No Pengadaan': 'K.TEL.000882/HK.810/GPP-000000/2026',
      'Serial Number': 'CSCO-ISR4331-K9-8271',
      'Customer': 'BPJS KESEHATAN',
      'Campaign': 'Batch 4 Rollout',
    },
    {
      'Hostname': '0202-D2-JKT-HRMN-PST01',
      'Order SDWAN': 'ORD-2026-JKT-992',
      'Kota': 'JAKARTA PUSAT',
      'No Pengadaan': 'K.TEL.000882/HK.810/GPP-000000/2026',
      'Serial Number': 'VCO-540-EDGE-9182',
      'Customer': 'RS HERMINA',
      'Campaign': 'Batch 4 Rollout',
    },
    {
      'Hostname': '0203-D4-SMG-YPT-SMK01',
      'Order SDWAN': 'ORD-2026-SMG-331',
      'Kota': 'SEMARANG',
      'No Pengadaan': 'K.TEL.000882/HK.810/GPP-000000/2026',
      'Serial Number': 'FGT60FTK21099234',
      'Customer': 'YAYASAN PENDIDIKAN TELKOM',
      'Campaign': 'Batch 4 Rollout',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);

  // Set explicit column widths
  ws['!cols'] = [
    { wch: 28 }, // Hostname
    { wch: 22 }, // Order SDWAN
    { wch: 20 }, // Kota
    { wch: 42 }, // No Pengadaan
    { wch: 24 }, // Serial Number
    { wch: 28 }, // Customer
    { wch: 20 }, // Campaign
  ];

  // Sheet 2: Format Specifications Guide
  const guideData = [
    {
      'Nama Kolom': 'Hostname',
      'Status': 'WAJIB (Required)',
      'Posisi Fisik di Stiker': 'Baris 1 (Arial Bold 8.5pt, tengah)',
      'Contoh Nilai': '0208-D5-SBY-IDM-T312',
      'Keterangan': 'Identifier unik perangkat SD-WAN edge/router. Menjadi kunci utama pencocokan ke database.',
    },
    {
      'Nama Kolom': 'Order SDWAN',
      'Status': 'WAJIB (Required)',
      'Posisi Fisik di Stiker': 'Baris 2 (Arial Bold 6.5pt, sebelum pemisah •)',
      'Contoh Nilai': 'ORD-2026-SUB-001 / SID SDWAN',
      'Keterangan': 'Nomor order SD-WAN atau SID layanan.',
    },
    {
      'Nama Kolom': 'Kota',
      'Status': 'Disarankan (Recommended)',
      'Posisi Fisik di Stiker': 'Baris 2 (Arial Bold 6.5pt, sesudah pemisah •)',
      'Contoh Nilai': 'SURABAYA',
      'Keterangan': 'Nama Witel / Kota instalasi perangkat.',
    },
    {
      'Nama Kolom': 'No Pengadaan',
      'Status': 'Disarankan (Standard Telkom)',
      'Posisi Fisik di Stiker': 'Baris 3 (Arial Bold 5.0pt, warna abu-abu #4a5568)',
      'Contoh Nilai': 'K.TEL.000882/HK.810/GPP-000000/2026',
      'Keterangan': 'Nomor kontrak / pengadaan resmi Telkom Indonesia. Ditampilkan di bagian bawah stiker.',
    },
    {
      'Nama Kolom': 'Serial Number',
      'Status': 'Opsional',
      'Posisi Fisik di Stiker': 'Tersimpan di Metadata & Trace Registry',
      'Contoh Nilai': 'FGT60FTK21049281',
      'Keterangan': 'Serial number hardware fisik untuk verifikasi barcode/SN.',
    },
    {
      'Nama Kolom': 'Customer',
      'Status': 'Opsional',
      'Posisi Fisik di Stiker': 'Tersimpan di Metadata & Trace Registry',
      'Contoh Nilai': 'INDOMARET / YAYASAN PENDIDIKAN TELKOM',
      'Keterangan': 'Nama instansi / pelanggan korporat.',
    },
    {
      'Nama Kolom': 'Campaign',
      'Status': 'Opsional',
      'Posisi Fisik di Stiker': 'Tersimpan di Metadata & Trace Registry',
      'Contoh Nilai': 'Batch 4 Rollout',
      'Keterangan': 'Nama batch roll-out atau penugasan logistik.',
    },
  ];

  const guideWs = XLSX.utils.json_to_sheet(guideData);
  guideWs['!cols'] = [
    { wch: 18 },
    { wch: 26 },
    { wch: 38 },
    { wch: 36 },
    { wch: 60 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Label Request');
  XLSX.utils.book_append_sheet(wb, guideWs, 'Format Guide');

  const fileName = `Template_Request_Sticker_Telkom_v4_${new Date().toISOString().substring(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
