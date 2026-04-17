'use client';

interface ListingContentAuditProps {
  /** Description length or content from property data */
  descriptionLength?: number;
  /** Number of photos */
  photoCount?: number;
  /** Number of amenities listed */
  amenityCount?: number;
  /** Known amenity gaps */
  amenityGaps?: string[];
  /** Cancellation policy type */
  cancellationPolicy?: string;
  /** Whether listing has professional photos */
  hasProfessionalPhotos?: boolean;
  isLoading: boolean;
}

interface AuditItem {
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'unknown';
  detail: string;
}

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  pass: { icon: '\u2713', color: 'text-green-600 bg-green-50' },
  warn: { icon: '!', color: 'text-amber-600 bg-amber-50' },
  fail: { icon: '\u2717', color: 'text-red-600 bg-red-50' },
  unknown: { icon: '?', color: 'text-[var(--text-muted)] bg-[var(--surface)]' },
};

export default function ListingContentAudit({
  descriptionLength,
  photoCount,
  amenityCount,
  amenityGaps = [],
  cancellationPolicy,
  hasProfessionalPhotos,
  isLoading,
}: ListingContentAuditProps) {
  if (isLoading) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Listing Content Audit</h3>
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-[var(--surface)] rounded" />
          ))}
        </div>
      </div>
    );
  }

  const auditItems: AuditItem[] = [
    {
      label: 'Description',
      status:
        descriptionLength === undefined ? 'unknown' :
        descriptionLength >= 500 ? 'pass' :
        descriptionLength >= 200 ? 'warn' : 'fail',
      detail:
        descriptionLength !== undefined
          ? `${descriptionLength} characters ${descriptionLength < 500 ? '(aim for 500+)' : ''}`
          : 'Not analyzed',
    },
    {
      label: 'Photos',
      status:
        photoCount === undefined ? 'unknown' :
        photoCount >= 20 ? 'pass' :
        photoCount >= 10 ? 'warn' : 'fail',
      detail:
        photoCount !== undefined
          ? `${photoCount} photos ${photoCount < 20 ? '(aim for 20+)' : ''}`
          : 'Not analyzed',
    },
    {
      label: 'Professional Photos',
      status:
        hasProfessionalPhotos === undefined ? 'unknown' :
        hasProfessionalPhotos ? 'pass' : 'warn',
      detail:
        hasProfessionalPhotos === undefined ? 'Not analyzed' :
        hasProfessionalPhotos ? 'Professional photography detected' : 'Consider professional photos',
    },
    {
      label: 'Amenities',
      status:
        amenityCount === undefined ? 'unknown' :
        amenityCount >= 30 ? 'pass' :
        amenityCount >= 15 ? 'warn' : 'fail',
      detail:
        amenityCount !== undefined
          ? `${amenityCount} amenities listed${amenityGaps.length > 0 ? ` (${amenityGaps.length} gaps found)` : ''}`
          : 'Not analyzed',
    },
    {
      label: 'Cancellation Policy',
      status:
        cancellationPolicy === undefined ? 'unknown' :
        cancellationPolicy === 'flexible' || cancellationPolicy === 'moderate' ? 'pass' :
        cancellationPolicy === 'strict' ? 'warn' : 'unknown',
      detail: cancellationPolicy || 'Not analyzed',
    },
  ];

  const passCount = auditItems.filter((item) => item.status === 'pass').length;
  const totalChecked = auditItems.filter((item) => item.status !== 'unknown').length;

  return (
    <div className="bg-[var(--card-bg)] rounded-lg border border-lc-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Listing Content Audit</h3>
        {totalChecked > 0 && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            passCount === totalChecked ? 'bg-green-100 text-green-700' :
            passCount >= totalChecked / 2 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {passCount}/{totalChecked} passing
          </span>
        )}
      </div>

      <div className="space-y-2">
        {auditItems.map((item) => {
          const style = STATUS_ICONS[item.status];

          return (
            <div key={item.label} className="flex items-center gap-3 py-2">
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${style.color}`}>
                {style.icon}
              </span>
              <div className="flex-1">
                <span className="text-sm font-medium text-[var(--text-secondary)]">{item.label}</span>
                <span className="text-xs text-[var(--text-muted)] ml-2">{item.detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Amenity gaps detail */}
      {amenityGaps.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--border)]">
          <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Missing Amenities (vs. competitors)</p>
          <div className="flex flex-wrap gap-1.5">
            {amenityGaps.map((gap) => (
              <span key={gap} className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs">
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
