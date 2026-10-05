export type AppRole = 'superadmin' | 'inventory_admin' | 'viewer'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: AppRole
  is_active: boolean
}
