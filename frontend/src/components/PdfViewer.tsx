interface Props {
  images: string[]   // base64 JPEG strings, one per page
}

export default function PdfViewer({ images }: Props) {
  if (images.length === 0) {
    return (
      <div className="w-96 shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        PDF preview unavailable
      </div>
    )
  }

  return (
    <div className="w-96 shrink-0 border-r border-gray-200 bg-gray-100 overflow-y-auto">
      <div className="p-2 space-y-2">
        {images.map((b64, i) => (
          <div key={i}>
            <p className="text-xs text-gray-400 text-center mb-1">Page {i + 1}</p>
            <img
              src={`data:image/jpeg;base64,${b64}`}
              alt={`Page ${i + 1}`}
              className="w-full rounded shadow-sm border border-gray-200"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
