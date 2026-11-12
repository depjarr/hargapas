function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => reject(new Error('File bukan gambar yang valid'))
    img.src = url
  })
}
function draw(img: HTMLImageElement, max: number) {
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c
}

/** Kecilkan foto sebelum diupload (hemat storage & cepat). */
export async function resizeImage(file: File, max = 900): Promise<Blob> {
  const c = draw(await load(file), max)
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('Gagal memproses gambar'))), 'image/jpeg', 0.85))
}

/** Untuk dikirim ke AI pembaca struk. */
export async function resizeToDataUrl(file: File, max = 1400): Promise<string> {
  return draw(await load(file), max).toDataURL('image/jpeg', 0.8)
}
