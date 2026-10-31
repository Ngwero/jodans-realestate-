export function createAuth(supabase) {
  return function auth(requiredRole) {
    return async (req, res, next) => {
      try {
        const header = req.headers.authorization || ''
        const token = header.startsWith('Bearer ') ? header.slice(7) : ''
        if (!token) return res.status(401).json({ error: 'Please sign in' })
        // Verify with Supabase Auth; never trust decoded JWT or user metadata.
        const { data, error } = await supabase.auth.getUser(token)
        if (error || !data.user) return res.status(401).json({ error: 'Please sign in again' })
        const { data: profile, error: profileError } = await supabase.from('app_profiles')
          .select('id,name,role,active').eq('id', data.user.id).single()
        if (profileError) throw profileError
        if (!profile.active) return res.status(403).json({ error: 'Account disabled' })
        if (requiredRole && profile.role !== requiredRole && profile.role !== 'admin') {
          return res.status(403).json({ error: 'Not allowed' })
        }
        req.user = { sub: profile.id, name: profile.name, role: profile.role, email: data.user.email }
        next()
      } catch (error) { next(error) }
    }
  }
}
