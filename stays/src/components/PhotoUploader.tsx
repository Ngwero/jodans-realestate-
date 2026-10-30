import { useState } from 'react'
import { api } from '../lib/api'

type Props = {
  images: string[]
  onChange: (images: string[]) => void
}

const MAX_PHOTOS = 8

export function PhotoUploader({ images, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return
    const room = MAX_PHOTOS - images.length
    if (room <= 0) {
      setError(`You can add up to ${MAX_PHOTOS} photos`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const urls = await api.uploadPhotos(Array.from(list).slice(0, room))
      onChange([...images, ...urls])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="photo-uploader">
      <span className="photo-uploader-label">Photos</span>
      {images.length > 0 && (
        <ul className="photo-grid">
          {images.map((src, index) => (
            <li key={`${src}-${index}`}>
              <img src={src} alt="" />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className={`photo-drop${busy ? ' busy' : ''}`}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          disabled={busy || images.length >= MAX_PHOTOS}
          onChange={(e) => {
            void addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {busy ? 'Uploading…' : 'Upload photos'}
        <small>JPEG, PNG, WebP, or GIF. Up to 8 photos, 8 MB each.</small>
      </label>
      {error && <p className="portal-error">{error}</p>}
    </div>
  )
}
