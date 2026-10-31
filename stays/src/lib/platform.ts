/** Main platform and homes links can be configured separately when deployed. */
export const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL || `${window.location.origin}/`
export const HOMES_URL = import.meta.env.VITE_HOMES_URL || `${window.location.origin}/`
