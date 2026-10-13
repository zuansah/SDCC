import React, { useState } from 'react';
import { BAData } from '../types';
import { ArrowLeft, Printer, Edit2, MapPin, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { exportBaReportToPdf } from '../utils/pdfExport';

interface BAPreviewProps {
  ba: BAData;
  onBack: () => void;
  onEdit: () => void;
}

export default function BAPreview({ ba, onBack, onEdit }: BAPreviewProps) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);

  const approverName = ba.status === 'accepted' && ba.acceptedBy 
    ? ba.acceptedBy 
    : '...................................';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const pageElements = Array.from(document.querySelectorAll<HTMLElement>('.ba-report-page'));
      if (pageElements.length === 0) {
        alert('Could not find document pages to generate PDF.');
        return;
      }
      const safeProjectName = (ba.projectName || 'SDWAN').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeSiteName = (ba.siteName || 'Site').replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportBaReportToPdf(
        pageElements,
        `BA_${safeProjectName}_${safeSiteName}.pdf`,
        (current, total) => setPdfProgress({ current, total })
      );
    } catch (err: any) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsExportingPdf(false);
      setPdfProgress(null);
    }
  };

  const PageContainer = ({ children, title, pageNumber }: { children: React.ReactNode, title?: string, pageNumber: number }) => (
    <div className="ba-report-page bg-white mx-auto w-[297mm] h-[210mm] shadow-lg mb-8 relative print:shadow-none print:mb-0 print:w-full print:h-screen print:page-break-after-always overflow-hidden flex flex-row border-[3px] border-black m-8 print:m-0">
      <div className="flex-1 p-8 flex flex-col relative overflow-hidden">
        {children}
      </div>
      
      {/* Right Sidebar Template */}
      <div className="w-[72mm] border-l-[3px] border-black flex flex-col shrink-0">
        <div className="h-[35mm] border-b-[3px] border-black flex flex-col p-4 relative">
          <div className="flex items-center justify-end h-16 w-full">
            <img src="/NSM%204K%20Resolution%20Logo.jpeg" alt="NSM 4K Logo" className="h-14 object-contain" />
          </div>
          <div className="text-[10px] text-slate-600 mt-auto">Remark : {ba.status === 'rejected' && ba.rejectNote ? <span className="text-red-600 font-medium">{ba.rejectNote}</span> : null}</div>
        </div>
        <div className="h-[20mm] border-b-[3px] border-black flex flex-col">
          <div className="flex-1 flex items-center justify-center font-bold text-xs italic">AS BUILD DRAWING</div>
          <div className="flex border-t-[3px] border-black text-[10px] text-center h-10">
            <div className="flex-1 border-r-[3px] border-black flex flex-col overflow-hidden">
              <span className="py-1 font-semibold">APPROVED By :</span>
              <span className="mt-auto pb-1 truncate px-1">( {approverName} )</span>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              <span className="py-1 font-semibold">PREPARED By :</span>
              <span className="mt-auto pb-1 truncate px-1">( {ba.preparedBy || '...................................'} )</span>
            </div>
          </div>
        </div>
        <div className="h-[18mm] border-b-[3px] border-black flex flex-col justify-center px-4 py-1">
          <div className="text-slate-500 text-[9px] italic">PROJECT NAME :</div>
          <div className="font-bold text-sm text-center mt-1 truncate">{ba.projectName || '[ Project Name ]'}</div>
        </div>
        <div className="h-[25mm] border-b-[3px] border-black flex flex-col justify-center px-4 py-1">
          <div className="text-slate-500 text-[9px] italic mb-1">DRAWING TITLE :</div>
          <div className="font-bold text-sm text-center">{title || 'CONTENTS'}</div>
          <div className="text-slate-500 text-[9px] italic mt-2">LOCATION :</div>
          <div className="font-semibold text-xs text-center mt-1 truncate">{ba.siteName || '[ Site Location ]'}</div>
        </div>
        <div className="flex-1 flex text-[10px] border-b-[3px] border-black">
           <div className="w-[15mm] border-r-[3px] border-black flex flex-col p-1">
             <span className="text-slate-500 text-[9px]">SCALA</span>
             <span className="font-bold mt-auto text-center mb-2 text-sm">NTS</span>
           </div>
           <div className="flex-1 flex flex-col">
             <div className="h-5 border-b-[3px] border-black flex items-center justify-center text-slate-500 text-[9px]">REVISION</div>
             <div className="flex border-b-[3px] border-black flex-1">
               <div className="w-8 border-r-[3px] border-black flex items-center justify-center text-slate-500 text-[9px]">NO</div>
               <div className="flex-1 border-r-[3px] border-black flex items-center justify-center text-slate-500 text-[9px]">DATE</div>
               <div className="w-12 flex items-center justify-center text-slate-500 text-[9px]">REF</div>
             </div>
             <div className="flex flex-1">
                {/* Empty space for revision records */}
             </div>
           </div>
        </div>
        <div className="h-[12mm] flex text-[10px] text-center">
           <div className="flex-1 border-r-[3px] border-black flex flex-col">
             <div className="border-b-[3px] border-black text-slate-500 flex-1 flex items-center justify-center text-[9px]">No. DRAWING</div>
             <div className="flex-1 flex items-center justify-center font-bold">NSM/ABD/0{pageNumber}</div>
           </div>
           <div className="w-[18mm] border-r-[3px] border-black flex flex-col">
             <div className="border-b-[3px] border-black text-slate-500 flex-1 flex items-center justify-center text-[9px]">SHEET</div>
             <div className="flex-1 flex items-center justify-center font-bold">Page-{pageNumber}</div>
           </div>
           <div className="w-[12mm] flex items-center justify-center text-xl font-bold">A4</div>
        </div>
      </div>
    </div>
  );

  const ImgBox = ({ label, src }: { label: string, src?: string }) => (
    <div className="h-full w-full border border-dashed border-slate-400 rounded-lg flex flex-col items-center justify-center relative overflow-hidden bg-slate-50">
      {src ? (
        <img src={src} alt={label} className="absolute inset-0 w-full h-full object-contain p-2" />
      ) : (
        <div className="text-slate-300 font-medium text-sm text-center px-4">{label}<br/><span className="text-xs font-normal">Sisipkan foto di sini</span></div>
      )}
    </div>
  );

  const Page789Layout = ({ title, pageNum, images }: { title: string, pageNum: number, images: {label: string, src?: string}[] }) => (
    <PageContainer title={title} pageNumber={pageNum}>
      <div className="h-full flex flex-col gap-4">
         <div className="flex-1 flex gap-4">
           <div className="flex-1 flex flex-col">
             <div className="flex-1"><ImgBox label="FOTO" src={images[0].src} /></div>
             <div className="h-10 border border-slate-400 mt-2 flex items-center justify-center font-bold text-sm bg-slate-100">{images[0].label}</div>
           </div>
           <div className="flex-1 flex flex-col">
             <div className="flex-1"><ImgBox label="FOTO" src={images[1].src} /></div>
             <div className="h-10 border border-slate-400 mt-2 flex items-center justify-center font-bold text-sm bg-slate-100">{images[1].label}</div>
           </div>
         </div>
         <div className="flex-1 flex gap-4">
           <div className="flex-1 flex flex-col">
             <div className="flex-1"><ImgBox label="FOTO" src={images[2].src} /></div>
             <div className="h-10 border border-slate-400 mt-2 flex items-center justify-center font-bold text-sm bg-slate-100">{images[2].label}</div>
           </div>
           <div className="flex-1 flex flex-col">
             <div className="flex-1"><ImgBox label="FOTO" src={images[3].src} /></div>
             <div className="h-10 border border-slate-400 mt-2 flex items-center justify-center font-bold text-sm bg-slate-100">{images[3].label}</div>
           </div>
         </div>
      </div>
    </PageContainer>
  );

  return (
    <div className="flex flex-col h-full bg-slate-100">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: A4 landscape;
              margin: 0;
            }
          }
        `,
        }}
      />
      {/* Top Action Bar (hidden in print) */}
      <div className="px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between shadow-sm print:hidden shrink-0">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
            Edit Document
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-md shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-60 transition"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {pdfProgress ? `Exporting PDF (${pdfProgress.current}/${pdfProgress.total})...` : 'Generating PDF...'}
                </span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download as PDF</span>
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Preview
          </button>
        </div>
      </div>

      {/* Document Pages Container */}
      <div className="flex-1 overflow-y-auto p-8 print:p-0">
        
        {/* PAGE 1: COVER */}
        <div className="ba-report-page bg-white mx-auto w-[297mm] h-[210mm] shadow-lg mb-8 relative print:shadow-none print:mb-0 print:w-full print:h-screen print:page-break-after-always overflow-hidden flex flex-col p-16 m-8 print:m-0 border-[3px] border-transparent">
          <div className="mt-8 flex flex-col items-start">
            <img src="/NSM%204K%20Resolution%20Logo.jpeg" alt="Next Gen Service Management" className="h-28 object-contain mb-4" />
            <h1 className="text-4xl font-bold text-slate-800">Next Gen Service Management</h1>
            <p className="text-3xl font-bold mt-4">Project Name : [ {ba.projectName || 'Project Name'} ]</p>
          </div>
          <div className="border-t-[4px] border-indigo-900 my-8 w-full"></div>
          <div className="mt-2">
            <h2 className="text-2xl font-bold">As Build Drawing</h2>
            <p className="text-xl font-bold mt-2">Site : [ {ba.siteName || 'Site Name'} ]</p>
          </div>
          <div className="mt-auto mb-4">
            <p className="text-sm font-medium mb-12">Disiapkan oleh :</p>
            <div className="w-80 border-b-[2px] border-dotted border-slate-400 mb-2 text-center text-sm font-medium pb-1">{ba.preparedBy}</div>
            <p className="text-xs text-slate-500 font-semibold">[ {ba.companyName || 'Nama Perusahaan Pelaksana'} ]</p>
          </div>
        </div>

        {/* PAGE 2: TABLE OF CONTENTS */}
        <PageContainer title="CONTENTS" pageNumber={2}>
           <div className="h-full flex flex-col">
             <table className="w-full border-collapse border border-black">
               <thead className="bg-green-100">
                 <tr>
                   <th colSpan={3} className="border border-black py-2 font-bold text-sm">TABEL OF CONTENS</th>
                 </tr>
                 <tr className="bg-slate-50 text-xs">
                   <th className="border border-black py-2 w-12">NO</th>
                   <th className="border border-black py-2">DESCRIPTION</th>
                   <th className="border border-black py-2 w-48">NO. DRAWING</th>
                 </tr>
               </thead>
               <tbody className="text-xs">
                 {[
                   { desc: 'COVER', draw: '01' },
                   { desc: 'CONTENTS', draw: '02' },
                   { desc: 'NETWORK TOPOLOGI', draw: '03' },
                   { desc: 'SITE LOCATION', draw: '04' },
                   { desc: 'EQUIPMENT PLACEMENT', draw: '05' },
                   { desc: 'LAYOUT', draw: '06' },
                   { desc: 'PHOTO ATTACHMENT', draw: '07' },
                   { desc: 'PHOTO ATTACHMENT', draw: '08' },
                   { desc: 'PHOTO ATTACHMENT', draw: '09' },
                 ].map((row, i) => (
                   <tr key={i}>
                     <td className="border border-black py-2 text-center">{i + 1}</td>
                     <td className="border border-black py-2 px-4">{row.desc}</td>
                     <td className="border border-black py-2 px-4">NSM/ABD/{row.draw}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </PageContainer>

        {/* PAGE 3: NETWORK TOPOLOGY */}
        <PageContainer title="NETWORK TOPOLOGI" pageNumber={3}>
          <div className="h-full flex items-center justify-center p-8">
             {ba.networkTopologyImg ? (
               <img src={ba.networkTopologyImg} className="max-w-full max-h-full object-contain" alt="Network Topology" />
             ) : (
               <div className="text-center text-slate-400 border-2 border-dashed border-slate-300 w-full h-full flex flex-col items-center justify-center rounded-lg">
                 <h2 className="text-xl font-bold mb-2">NETWORK TOPOLOGY DIAGRAM</h2>
                 <p className="text-sm">Sisipkan diagram topologi jaringan di sini</p>
               </div>
             )}
          </div>
        </PageContainer>

        {/* PAGE 4: SITE LOCATION */}
        <PageContainer title="SITE LOCATION" pageNumber={4}>
          <div className="flex h-full gap-8">
            <div className="flex-1 space-y-6 text-sm flex flex-col border border-black p-6">
              {[
                { l: '1. Nama Lokasi :', v: ba.locationName },
                { l: '2. Alamat Lokasi Instalasi :', v: ba.installAddress },
                { l: '3. Alamat Pengiriman Barang :', v: ba.deliveryAddress },
                { l: '4. Jam Operasional Lokasi :', v: ba.operationalHours },
                { l: '5. Koordinator Lokasi ( Nama ) :', v: ba.coordinator },
                { l: '6. Koordinator Lokasi ( No. Telp ) :', v: ba.coordinatorTelp },
                { l: '7. Lokasi Instalasi Perangkat ( Lantai / Ruangan ) :', v: ba.installLocation },
              ].map((item, i) => (
                <div key={i} className="mb-4">
                  <div className="font-bold mb-1">{item.l}</div>
                  <div className="border-b border-dotted border-slate-400 pb-1 text-slate-700 min-h-[1.5rem]">
                    {item.v || ''}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-1 flex flex-col border-2 border-dashed border-slate-300 items-center justify-center relative bg-slate-50">
              {ba.mapCoordinateImg ? (
                ba.mapCoordinateImg.startsWith('data:image') ? (
                  <img src={ba.mapCoordinateImg} className="absolute inset-0 w-full h-full object-cover" alt="Map" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-50 text-center z-10">
                    <MapPin className="w-8 h-8 text-blue-500 mb-2" />
                    <h2 className="font-bold text-lg text-slate-700 mb-1">MAP / SITE COORDINATE</h2>
                    <a href={ba.mapCoordinateImg} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                      {ba.mapCoordinateImg}
                    </a>
                  </div>
                )
              ) : ba.mapCoordinateLink ? (
                <iframe 
                  className="absolute inset-0 w-full h-full"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://maps.google.com/maps?q=${ba.mapCoordinateLink.split('q=')[1]}&hl=en&z=15&output=embed`}
                />
              ) : (
                <div className="text-center text-slate-400 z-10 absolute inset-0 flex flex-col items-center justify-center">
                  <h2 className="font-bold text-lg mb-1">MAP / SITE COORDINATE</h2>
                  <p className="text-xs">Sisipkan tangkapan peta lokasi di sini</p>
                </div>
              )}
              {ba.mapCoordinateLink && (
                 <div className="absolute bottom-2 left-2 right-2 bg-white/90 p-2 rounded text-center z-20 shadow-sm border border-slate-200">
                    <a href={ba.mapCoordinateLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline break-all block">{ba.mapCoordinateLink}</a>
                 </div>
              )}
            </div>
          </div>
        </PageContainer>

        {/* PAGE 5: EQUIPMENT PLACEMENT */}
        <PageContainer title="EQUIPMENT PLACEMENT" pageNumber={5}>
          <div className="flex h-full gap-8">
            <div className="w-full flex flex-col relative">
              <div className="border border-black px-4 py-2 text-sm font-bold bg-blue-50 absolute -top-8 left-0">
                NEW DEVICE [ {ba.deviceType || 'Type / Model'} ] {ba.serialNumber ? ` | SN: ${ba.serialNumber}` : ''}
              </div>
              <div className="flex-1 border-2 border-dashed border-slate-300 mt-2 flex flex-col items-center justify-center relative bg-slate-50">
                {ba.equipmentPlacementImg ? (
                  <img src={ba.equipmentPlacementImg} className="absolute inset-0 w-full h-full object-contain p-4" alt="Equipment" />
                ) : (
                  <div className="text-center text-slate-400">
                    <h2 className="font-bold text-lg mb-1">RACK / EQUIPMENT PLACEMENT</h2>
                    <p className="text-xs">Sisipkan foto penempatan perangkat pada rack</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </PageContainer>

        {/* PAGE 6: LAYOUT */}
        <PageContainer title="LAYOUT" pageNumber={6}>
          <div className="h-full flex items-center justify-center p-8">
             {ba.floorLayoutImg ? (
               <img src={ba.floorLayoutImg} className="max-w-full max-h-full object-contain" alt="Floor Layout" />
             ) : (
               <div className="text-center text-slate-400 border-2 border-dashed border-slate-300 w-full h-full flex flex-col items-center justify-center rounded-lg bg-slate-50">
                 <h2 className="text-xl font-bold mb-2">FLOOR / ROOM LAYOUT</h2>
                 <p className="text-sm">Sisipkan denah ruangan dan posisi perangkat di sini</p>
               </div>
             )}
          </div>
        </PageContainer>

        {/* PAGE 7: PHOTO ATTACHMENT */}
        <Page789Layout 
          title="PHOTO ATTACHMENT" 
          pageNum={7}
          images={[
            { label: 'Foto Tampak Depan', src: ba.frontViewImg },
            { label: 'Foto Bersama PIC', src: ba.withPicImg },
            { label: 'Rack Before', src: ba.rackBeforeImg },
            { label: 'Rack After', src: ba.rackAfterImg }
          ]} 
        />

        {/* PAGE 8: PHOTO ATTACHMENT */}
        <Page789Layout 
          title="PHOTO ATTACHMENT" 
          pageNum={8}
          images={[
            { label: 'SN Perangkat SD-WAN', src: ba.snSdwanImg },
            { label: 'Asset Label', src: ba.snOntImg },
            { label: 'Speedtest Global', src: ba.speedtestGlobalImg },
            { label: 'Speedtest Domestik', src: ba.speedtestDomestikImg }
          ]} 
        />

        {/* PAGE 9: PHOTO ATTACHMENT */}
        <Page789Layout 
          title="PHOTO ATTACHMENT" 
          pageNum={9}
          images={[
            { label: 'Cabling SD-WAN', src: ba.cablingSdwanImg },
            { label: 'SD-WAN Box', src: ba.sdwanBoxImg },
            { label: 'Ping - Traceroute', src: ba.pingTracerouteImg },
            { label: 'Ping P2P Astinet', src: ba.pingAstinetImg }
          ]} 
        />

      </div>
    </div>
  );
}
