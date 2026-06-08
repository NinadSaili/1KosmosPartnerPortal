import React, { useState } from 'react';
import { format } from 'date-fns';
import { Download, Share2, Award, XCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { IssuedCertificate } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CertificateCardProps {
  certificate: IssuedCertificate;
  certificationTitle: string;
  recipientName: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CertificateCard({
  certificate,
  certificationTitle,
  recipientName,
}: CertificateCardProps) {
  const [copied, setCopied] = useState(false);

  const isExpired = certificate.expiresAt
    ? new Date(certificate.expiresAt) < new Date()
    : false;

  const handleShare = async () => {
    const url = `${window.location.origin}/certificates/${certificate.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text from an input
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg">
      {/* Revoked banner */}
      {certificate.isRevoked && (
        <div className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center rounded-2xl">
          <XCircle className="h-12 w-12 text-red-400 mb-2" />
          <p className="text-white font-bold text-lg uppercase tracking-widest">Revoked</p>
          <p className="text-red-300 text-sm mt-1">This certificate is no longer valid</p>
        </div>
      )}

      {/* Certificate body */}
      <div
        className={`relative p-6 ${
          certificate.isRevoked
            ? 'bg-gray-700 opacity-60'
            : isExpired
            ? 'bg-gradient-to-br from-gray-500 via-gray-600 to-gray-700'
            : 'bg-gradient-to-br from-amber-500 via-yellow-500 to-indigo-600'
        }`}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-white/10 -translate-y-1/4 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-white/10 translate-y-1/4 -translate-x-1/4" />

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-white font-extrabold text-sm">1K</span>
              </div>
              <div>
                <p className="text-white/80 text-xs font-medium tracking-widest uppercase">
                  1Kosmos
                </p>
                <p className="text-white/60 text-[10px] tracking-wide">Partner Portal</p>
              </div>
            </div>
            <Award className="h-8 w-8 text-white/80" />
          </div>

          {/* Certificate text */}
          <div className="text-center py-4">
            <p className="text-white/70 text-xs uppercase tracking-[0.2em] mb-1">
              Certificate of Achievement
            </p>
            <p className="text-white font-bold text-xl leading-tight mb-1">{certificationTitle}</p>
            <p className="text-white/60 text-xs mb-3">awarded to</p>
            <p className="text-white font-semibold text-lg">{recipientName}</p>
          </div>

          {/* Footer info */}
          <div className="flex items-end justify-between mt-4 pt-3 border-t border-white/20">
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wide">Cert. Number</p>
              <p className="text-white font-mono text-xs font-semibold">{certificate.certNumber}</p>
            </div>
            <div className="text-center">
              <p className="text-white/50 text-[10px] uppercase tracking-wide">Issued</p>
              <p className="text-white text-xs">
                {format(new Date(certificate.issuedAt), 'MMM d, yyyy')}
              </p>
            </div>
            {certificate.expiresAt && (
              <div className="text-right">
                <p className="text-white/50 text-[10px] uppercase tracking-wide">Expires</p>
                <p className={`text-xs ${isExpired ? 'text-red-300' : 'text-white'}`}>
                  {format(new Date(certificate.expiresAt), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions bar */}
      {!certificate.isRevoked && (
        <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-2xl">
          {certificate.pdfUrl ? (
            <a
              href={certificate.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button size="sm" variant="outline" className="w-full flex items-center gap-1.5">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </a>
          ) : (
            <Button size="sm" variant="outline" className="flex-1" disabled>
              <Download className="h-4 w-4 mr-1.5" />
              PDF Unavailable
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleShare}
            className="flex items-center gap-1.5 flex-shrink-0"
            title="Copy share link"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Share
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
