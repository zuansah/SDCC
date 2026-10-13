import React, { useEffect, useRef, useState } from 'react';
import { generateAndVerifyQrSvg } from '../utils/traceUtils';
import { downloadElementAsPng, downloadSvgFile } from '../utils/pdfExport';
import { Download, Image as ImageIcon, QrCode } from 'lucide-react';

interface PhysicalStickerPreviewProps {
  hostname: string;
  orderNumber?: string;
  kota?: string;
  pengadaan?: string;
  traceId?: string;
  qrSvg?: string;
  scale?: number; // scale multiplier for UI display (default: 1.0)
  className?: string;
  showDownloadButtons?: boolean;
}

export default function PhysicalStickerPreview({
  hostname,
  orderNumber = '',
  kota = '',
  pengadaan = 'K.TEL.000882/HK.810/GPP-000000/2026',
  traceId = 'TLK-000000',
  qrSvg: providedQrSvg,
  scale = 1.0,
  className = '',
  showDownloadButtons = false,
}: PhysicalStickerPreviewProps) {
  const [internalQrSvg, setInternalQrSvg] = useState<string>(providedQrSvg || '');
  const [isExporting, setIsExporting] = useState(false);
  const stickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (providedQrSvg) {
      setInternalQrSvg(providedQrSvg);
      return;
    }
    let isCancelled = false;
    generateAndVerifyQrSvg(traceId || 'TLK-SAMPLE').then((res) => {
      if (!isCancelled) {
        setInternalQrSvg(res.svg);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [traceId, providedQrSvg]);

  const hostLength = hostname ? hostname.length : 0;
  const hostFontSize = hostLength > 32 ? '7.5pt' : '8.5pt';

  const handleDownloadStickerPng = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!stickerRef.current) return;
    setIsExporting(true);
    try {
      const safeName = (hostname || traceId || 'Sticker').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadElementAsPng(stickerRef.current, `Sticker_${safeName}.png`, 3);
    } catch (err) {
      console.error('Failed to download sticker PNG:', err);
      alert('Failed to download sticker PNG');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadQrSvg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!internalQrSvg) {
      alert('QR SVG not ready yet');
      return;
    }
    const safeName = (traceId || hostname || 'QR').replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadSvgFile(internalQrSvg, `QR_${safeName}.svg`);
  };

  return (
    <div className="flex flex-col items-center">
      <div
        ref={stickerRef}
        className={`relative bg-white flex flex-col justify-between overflow-hidden text-black select-none border border-slate-300 shadow-xs rounded-xs ${className}`}
        style={{
        width: `${63.5 * scale}mm`,
        height: `${38.1 * scale}mm`,
        minWidth: `${63.5 * scale}mm`,
        minHeight: `${38.1 * scale}mm`,
        maxWidth: `${63.5 * scale}mm`,
        maxHeight: `${38.1 * scale}mm`,
        boxSizing: 'border-box',
        paddingTop: `${1.2 * scale}mm`,
        paddingBottom: `${1.0 * scale}mm`,
        paddingLeft: `${2.5 * scale}mm`,
        paddingRight: `${2.5 * scale}mm`,
        transformOrigin: 'top left',
      }}
    >
      {/* Top row: QR (20.5 x 20.5 mm, left) and Telkom Logo (19.0 x 10.4 mm, right) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: `${20.5 * scale}mm`,
          minHeight: `${20.5 * scale}mm`,
          maxHeight: `${20.5 * scale}mm`,
        }}
      >
        {/* QR Code on Left: Exactly 20.5 x 20.5 mm */}
        <div
          className="label-qr-box shrink-0 bg-white"
          style={{
            width: `${20.5 * scale}mm`,
            height: `${20.5 * scale}mm`,
            minWidth: `${20.5 * scale}mm`,
            minHeight: `${20.5 * scale}mm`,
            maxWidth: `${20.5 * scale}mm`,
            maxHeight: `${20.5 * scale}mm`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {internalQrSvg ? (
            <div
              style={{ width: `${20.5 * scale}mm`, height: `${20.5 * scale}mm` }}
              className="[&>svg]:!w-full [&>svg]:!h-full [&>svg]:block"
              dangerouslySetInnerHTML={{ __html: internalQrSvg }}
            />
          ) : (
            <div
              style={{ width: `${20.5 * scale}mm`, height: `${20.5 * scale}mm` }}
              className="bg-slate-50 flex items-center justify-center text-[7pt] text-slate-400 font-mono"
            >
              QR
            </div>
          )}
        </div>

        {/* Telkom Indonesia Logo on Right: Exactly 19.0 x 10.4 mm */}
        <div
          className="shrink-0 flex items-center justify-end"
          style={{
            width: `${19.0 * scale}mm`,
            height: `${10.4 * scale}mm`,
            minWidth: `${19.0 * scale}mm`,
            minHeight: `${10.4 * scale}mm`,
            maxWidth: `${19.0 * scale}mm`,
            maxHeight: `${10.4 * scale}mm`,
          }}
        >
          <img
            src="/telkom-indonesia-logo.png"
            alt="Telkom Indonesia"
            style={{
              width: `${19.0 * scale}mm`,
              height: `${10.4 * scale}mm`,
              objectFit: 'contain',
              display: 'block',
            }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      </div>

      {/* Label Body: 3 Centred Lines (Arial bold) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
          marginTop: `${0.8 * scale}mm`,
        }}
      >
        {/* Line 1: Hostname - Arial bold 8.5 pt, black, centred */}
        <div
          style={{
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fontSize: `calc(${hostFontSize} * ${scale})`,
            color: '#000000',
            textAlign: 'center',
            lineHeight: '1.15',
            width: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={hostname}
        >
          {hostname || 'HOSTNAME-SAMPLE'}
        </div>

        {/* Line 2: Order · kota - Arial bold 7.0 pt, black, centred */}
        <div
          style={{
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fontSize: `calc(7.0pt * ${scale})`,
            color: '#000000',
            textAlign: 'center',
            lineHeight: '1.2',
            marginTop: `${0.6 * scale}mm`,
            width: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {orderNumber && kota
            ? `${orderNumber}  ·  ${kota}`
            : (orderNumber || kota || 'ORDER-SAMPLE  ·  JAKARTA')}
        </div>

        {/* Line 3: Pengadaan - Arial bold 5.0 pt, grey #9C9C9C, centred */}
        <div
          style={{
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fontSize: `calc(5.0pt * ${scale})`,
            color: '#9C9C9C',
            textAlign: 'center',
            lineHeight: '1.2',
            marginTop: `${0.5 * scale}mm`,
            width: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={pengadaan}
        >
          {pengadaan || 'K.TEL.000882/HK.810/GPP-000000/2026'}
        </div>
      </div>
    </div>

      {showDownloadButtons && (
        <div className="flex items-center gap-2 mt-3 pt-1">
          <button
            type="button"
            onClick={handleDownloadStickerPng}
            disabled={isExporting}
            className="h-7 px-2.5 text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download this sticker as high-res PNG image"
          >
            <ImageIcon className="w-3 h-3 text-blue-600" />
            <span>{isExporting ? 'Exporting...' : 'Download Sticker (PNG)'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadQrSvg}
            className="h-7 px-2.5 text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
            title="Download QR code vector SVG file"
          >
            <QrCode className="w-3 h-3 text-purple-600" />
            <span>Download QR (SVG)</span>
          </button>
        </div>
      )}
    </div>
  );
}
