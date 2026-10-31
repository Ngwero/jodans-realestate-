import { isDeepStrictEqual } from 'node:util'

export function createDatabase(supabase) {
  const snapshots = new WeakMap()
  return {
    async readDb() {
      const { data, error } = await supabase.rpc('app_read_state')
      if (error) throw error
      snapshots.set(data, structuredClone(data))
      return data
    },
    async writeDb(db) {
      const before = snapshots.get(db)
      if (!before) throw new Error('Database write requires a fresh snapshot')
      const oldListings = new Map(before.listings.map(row => [row.id, row]))
      const newListings = new Map(db.listings.map(row => [row.id, row]))
      const oldUsers = new Map(before.users.map(row => [row.id, row]))
      const oldActivity = new Set(before.activity.map(row => row.id))
      const newActivity = new Set(db.activity.map(row => row.id))
      const changes = {
        listings: db.listings.filter(row => !isDeepStrictEqual(row, oldListings.get(row.id)))
          .map(row => ({ id: row.id, data: row, expected: oldListings.get(row.id) ?? null })),
        deletedListings: before.listings.filter(row => !newListings.has(row.id))
          .map(row => ({ id: row.id, expected: row })),
        profiles: db.users.filter(row => {
          const old = oldUsers.get(row.id)
          return old && (row.name !== old.name || row.active !== old.active)
        }).map(row => ({ id: row.id, name: row.name, active: row.active,
          expectedName: oldUsers.get(row.id).name, expectedActive: oldUsers.get(row.id).active })),
        activity: db.activity.filter(row => !oldActivity.has(row.id)),
        deletedActivity: before.activity.filter(row => !newActivity.has(row.id)).map(row => row.id),
      }
      const { error } = await supabase.rpc('app_apply_changes', { changes })
      if (error) throw error
      snapshots.set(db, structuredClone(db))
    },
  }
}
