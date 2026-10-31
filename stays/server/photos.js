import { randomUUID } from 'node:crypto'

export const PHOTO_BUCKET = 'property-photos'
export const PHOTO_TYPES = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/gif', '.gif'],
])

export async function uploadPhotos(supabase, userId, files) {
  const bucket = supabase.storage.from(PHOTO_BUCKET)
  const uploaded = []
  try {
    for (const file of files) {
      const extension = PHOTO_TYPES.get(file.mimetype)
      if (!extension) throw new Error('Unsupported photo type')
      const objectPath = `${userId}/${randomUUID()}${extension}`
      const { error } = await bucket.upload(objectPath, file.buffer, { contentType: file.mimetype, upsert: false })
      if (error) throw error
      uploaded.push(objectPath)
    }
    return uploaded.map(objectPath => bucket.getPublicUrl(objectPath).data.publicUrl)
  } catch (error) {
    // Do not leave partial uploads behind after a failed batch.
    if (uploaded.length) await bucket.remove(uploaded)
    throw error
  }
}
