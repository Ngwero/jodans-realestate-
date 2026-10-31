/** Main platform and homes links can be configured separately when deployed. */
export const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL || 'http://127.0.0.1:8080/home.html'
export const HOMES_URL = import.meta.env.VITE_HOMES_URL || `${window.location.origin}/`
