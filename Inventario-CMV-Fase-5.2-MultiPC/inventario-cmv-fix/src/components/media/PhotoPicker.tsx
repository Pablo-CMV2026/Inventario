import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { validatePhotoFile } from '../../services/media/mediaService'

type Props = {
  files: File[]
  onChange: (files: File[]) => void
  maxFiles?: number
  disabled?: boolean
}

export function PhotoPicker({ files, onChange, maxFiles = 5, disabled = false }: Props) {
  const [error, setError] = useState('')
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files])

  useEffect(() => () => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url))
  }, [previews])

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (incoming.length === 0) return

    setError('')
    const accepted: File[] = []
    for (const file of incoming) {
      try {
        validatePhotoFile(file)
        accepted.push(file)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Una fotografía no es válida.')
        break
      }
    }

    if (accepted.length === 0) return
    const merged = [...files, ...accepted]
    if (merged.length > maxFiles) {
      setError(`Puedes adjuntar hasta ${maxFiles} fotografías por vez.`)
      onChange(merged.slice(0, maxFiles))
      return
    }
    onChange(merged)
  }

  function remove(index: number) {
    onChange(files.filter((_, current) => current !== index))
  }

  return <div className="photo-picker">
    <div className="photo-picker-actions">
      <label className={`photo-capture-button ${disabled ? 'disabled' : ''}`}>
        <Camera size={18} />
        <span>Tomar foto</span>
        <input
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          onChange={addFiles}
          disabled={disabled || files.length >= maxFiles}
        />
      </label>
      <label className={`secondary-button photo-file-button ${disabled ? 'disabled' : ''}`}>
        <ImagePlus size={18} />
        <span>Elegir foto</span>
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          onChange={addFiles}
          disabled={disabled || files.length >= maxFiles}
        />
      </label>
      <span className="photo-counter">{files.length}/{maxFiles}</span>
    </div>

    {error && <div className="notice error">{error}</div>}

    {previews.length > 0 && <div className="photo-preview-grid">
      {previews.map((preview, index) => <figure className="photo-preview" key={`${preview.file.name}-${preview.file.lastModified}-${index}`}>
        <img src={preview.url} alt={`Fotografía seleccionada ${index + 1}`} />
        <button type="button" onClick={() => remove(index)} aria-label={`Quitar fotografía ${index + 1}`} disabled={disabled}>
          <X size={15} />
        </button>
      </figure>)}
    </div>}

    <p className="field-help">JPG o PNG, máximo 10 MB por fotografía. En iPhone, “Tomar foto” solicita la cámara trasera.</p>
  </div>
}
