const API_BASE = import.meta.env.VITE_API_URL || ''

export type SessionUser = {
  id: string
  email: string
  name: string
  role: 'admin' | 'host'
}

export type ActivityItem = {
  id: string
  at: string
  actor?: string
  action: string
  listingId?: string
  detail?: string
}

export type AdminHost = {
  id: string
  email: string
  name: string
  active: boolean
  createdAt?: string | null
  listings: number
  pending: number
  approved: number
  rejected: number
}

export type AdminStats = {
  listings: number
  approved: number
  pending: number
  rejected: number
  hidden: number
  hosts: number
  activeHosts: number
  disabledHosts: number
  forSale: number
  forRent: number
  avgUgx: number
  avgUsd: number
}

export type AdminAnalytics = {
  byDistrict: { name: string; count: number }[]
  byArea?: { name: string; count: number; district?: string }[]
  byCategory: { name: string; count: number }[]
  byType: { name: string; count: number }[]
  byStatus: { name: string; count: number }[]
  byApproval: { name: string; count: number }[]
  byCurrency: { name: string; count: number }[]
}

export type AdminGeo = {
  places: {
    name: string
    lat: number
    lng: number
    district: string
    count: number
    approved: number
    pending: number
    forSale: number
    forRent: number
  }[]
  bounds: { south: number; west: number; north: number; east: number }
}

export type ListingDto = {
  id: string
  code?: string
  title: string
  location: string
  region: string
  district?: string
  price: number
  currency?: string
  rating: number
  reviews: number
  guests: number
  bedrooms: number
  beds: number
  baths: number
  type: string
  category: string
  host: string
  hostYears: number
  phone?: string
  status?: string
  description: string
  amenities: string[]
  images: string[]
  approval?: string
  hostId?: string
  createdAt?: string
  updatedAt?: string
  moderationNote?: string
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('jb_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
  }
  if (options.headers) {
    const extra = new Headers(options.headers)
    extra.forEach((value, key) => {
      headers[key] = value
    })
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

export type AdminListingsQuery = {
  approval?: string
  q?: string
  district?: string
  category?: string
  status?: string
  hostId?: string
  sort?: string
  page?: number
  pageSize?: number
}

function listingsQuery(params: AdminListingsQuery = {}) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== 'all') sp.set(k, String(v))
  })
  const qs = sp.toString()
  return `/api/admin/listings${qs ? `?${qs}` : ''}`
}

export const api = {
  login: (email: string, password: string, role?: 'admin' | 'host') =>
    request<{ token: string; user: SessionUser }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password, role }),
    }),
  registerHost: (name: string, email: string, password: string) =>
    request<{ message: string }>('/api/auth/register-host', {
      method: 'POST', body: JSON.stringify({ name, email, password }),
    }),
  requestPasswordReset: (email: string) => request<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST', body: JSON.stringify({ email }),
  }),
  resendVerification: (email: string) => request<{ message: string }>('/api/auth/resend-verification', {
    method: 'POST', body: JSON.stringify({ email }),
  }),
  verifyEmail: (token: string) => request<{ message: string }>('/api/auth/verify-email', {
    method: 'POST', body: JSON.stringify({ token }),
  }),
  resetPassword: (token: string, password: string) => request<{ message: string }>('/api/auth/reset-password', {
    method: 'POST', body: JSON.stringify({ token, password }),
  }),
  me: () => request<{ user: SessionUser }>('/api/auth/me'),
  health: () => request<{ ok: boolean }>('/api/health'),
  publicListings: () =>
    request<{ listings: ListingDto[]; total: number }>('/api/listings'),
  publicListing: (id: string) =>
    request<{ listing: ListingDto }>(`/api/listings/${id}`),
  hostListings: () =>
    request<{ listings: ListingDto[] }>('/api/host/listings'),
  createListing: (body: Record<string, unknown>) =>
    request<{ listing: ListingDto }>('/api/host/listings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateListing: (id: string, body: Record<string, unknown>) =>
    request<{ listing: ListingDto }>(`/api/host/listings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteHostListing: (id: string) =>
    request<{ ok: boolean }>(`/api/host/listings/${id}`, { method: 'DELETE' }),
  adminStats: () => request<{ totals: AdminStats }>('/api/admin/stats'),
  adminAnalytics: () => request<AdminAnalytics>('/api/admin/analytics'),
  adminGeo: () => request<AdminGeo>('/api/admin/geo'),
  adminActivity: (limit = 80) =>
    request<{ activity: ActivityItem[] }>(`/api/admin/activity?limit=${limit}`),
  adminListings: (params: AdminListingsQuery | string = {}) => {
    if (typeof params === 'string') {
      return request<{
        listings: ListingDto[]
        total: number
        page: number
        pageSize: number
        pages: number
      }>(listingsQuery({ approval: params }))
    }
    return request<{
      listings: ListingDto[]
      total: number
      page: number
      pageSize: number
      pages: number
    }>(listingsQuery(params))
  },
  adminListing: (id: string) =>
    request<{
      listing: ListingDto
      host: { id: string; name: string; email: string; active: boolean } | null
      activity: ActivityItem[]
    }>(`/api/admin/listings/${id}`),
  adminUpdateListing: (id: string, body: Record<string, unknown>) =>
    request<{ listing: ListingDto }>(`/api/admin/listings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  setApproval: (id: string, approval: string, note = '') =>
    request<{ listing: ListingDto }>(`/api/admin/listings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ approval, note }),
    }),
  bulkApproval: (ids: string[], approval: string) =>
    request<{ ok: boolean; updated: number }>('/api/admin/listings/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids, approval }),
    }),
  deleteAdminListing: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/listings/${id}`, { method: 'DELETE' }),
  adminHosts: () => request<{ hosts: AdminHost[] }>('/api/admin/hosts'),
  adminHost: (id: string) =>
    request<{
      host: {
        id: string
        email: string
        name: string
        active: boolean
        createdAt?: string | null
      }
      listings: ListingDto[]
    }>(`/api/admin/hosts/${id}`),
  setHostActive: (id: string, active: boolean) =>
    request<{ host: { id: string; email: string; name: string; active: boolean } }>(
      `/api/admin/hosts/${id}`,
      { method: 'PATCH', body: JSON.stringify({ active }) },
    ),
  createAdminListing: (body: Record<string, unknown>) =>
    request<{ listing: ListingDto }>('/api/admin/listings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  uploadPhotos: async (files: File[]) => {
    const body = new FormData()
    files.forEach((file) => body.append('photos', file))
    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: 'POST',
      headers: authHeaders(),
      body,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return (data.urls || []) as string[]
  },
}
