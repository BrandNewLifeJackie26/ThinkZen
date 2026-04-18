export default function TagChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-indigo-900 leading-none">
          ×
        </button>
      )}
    </span>
  )
}
