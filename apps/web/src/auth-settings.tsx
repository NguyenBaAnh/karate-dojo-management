import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { IntegrationSettingsTab } from './integration-settings'

const apiBase = import.meta.env.VITE_API_URL ?? '/api'

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { ...init, credentials: 'include' })
}

export function apiAssetUrl(value?: string | null) {
  const raw = String(value ?? '').trim()
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return raw

  const apiIsAbsolute = /^https?:\/\//i.test(apiBase)

  if (raw.startsWith('/api/')) {
    if (apiIsAbsolute) return `${new URL(apiBase).origin}${raw}`
    return raw
  }

  try {
    const parsed = new URL(raw)
    if (parsed.pathname.startsWith('/api/') && !apiIsAbsolute) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  } catch {}

  return raw
}

export type AuthUser = {
  id: string
  username: string
  fullName: string
  phone?: string | null
  email?: string | null
  avatarUrl?: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED'
  roles: Array<{ id: string; code: string; name: string }>
  permissions: string[]
}

export type PublicBrand = {
  dojoName: string
  shortName: string
  slogan: string
  address: string
  phone: string
  email: string
  website: string
  logoUrl: string | null
  defaultTheme: 'light' | 'dark' | 'system'
  accentColor: string
  registrationOpen: boolean
  needsSetup: boolean
}

type AuthGateContext = {
  user: AuthUser
  brand: PublicBrand
  logout: () => Promise<void>
  updateUser: (user: AuthUser) => void
  updateBrand: (brand: Partial<PublicBrand>) => void
  applyAppearance: (theme: 'light' | 'dark' | 'system', accent: string) => void
}

const defaultBrand: PublicBrand = {
  dojoName: 'KARATE DOJO',
  shortName: 'KARATE',
  slogan: 'Management System',
  address: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: null,
  defaultTheme: 'light',
  accentColor: '#b91c1c',
  registrationOpen: true,
  needsSetup: true,
}

function resolveTheme(mode: 'light' | 'dark' | 'system') {
  if (mode !== 'system') return mode
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode: 'light' | 'dark' | 'system', accent: string) {
  document.documentElement.dataset.theme = resolveTheme(mode)
  document.documentElement.style.setProperty('--app-accent', accent || '#b91c1c')
  document.documentElement.style.setProperty('--app-accent-soft', `${accent || '#b91c1c'}18`)
}

export function AuthGate({ children }: { children: (ctx: AuthGateContext) => ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [brand, setBrand] = useState<PublicBrand>(defaultBrand)

  const loadPublic = async () => {
    try {
      const response = await authFetch(`${apiBase}/settings/public`)
      if (response.ok) {
        const data = await response.json()
        setBrand((current) => ({ ...current, ...data }))
        const theme = (localStorage.getItem('karate-theme') as PublicBrand['defaultTheme'] | null) ?? data.defaultTheme ?? 'light'
        const accent = localStorage.getItem('karate-accent') ?? data.accentColor ?? '#b91c1c'
        applyTheme(theme, accent)
      }
    } catch {}
  }

  const loadSession = async () => {
    try {
      const response = await authFetch(`${apiBase}/auth/me`, { cache: 'no-store' })
      if (response.ok) setUser(await response.json())
      else setUser(null)
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    void (async () => {
      await loadPublic()
      await loadSession()
      setLoading(false)
    })()
  }, [])

  const logout = async () => {
    await authFetch(`${apiBase}/auth/logout`, { method: 'POST' }).catch(() => undefined)
    setUser(null)
    await loadPublic()
  }

  const updateBrand = (patch: Partial<PublicBrand>) => setBrand((current) => ({ ...current, ...patch }))
  const applyAppearance = (theme: PublicBrand['defaultTheme'], accent: string) => {
    localStorage.setItem('karate-theme', theme)
    localStorage.setItem('karate-accent', accent)
    applyTheme(theme, accent)
    setBrand((current) => ({ ...current, defaultTheme: theme, accentColor: accent }))
  }

  if (loading) {
    return <div className="auth-loading"><div className="auth-spinner"/><strong>Đang tải hệ thống võ đường...</strong></div>
  }

  if (!user) {
    return <AuthScreen brand={brand} onAuthenticated={(next) => { setUser(next); void loadPublic() }} />
  }

  return <>{children({ user, brand, logout, updateUser: setUser, updateBrand, applyAppearance })}</>
}

function AuthScreen({ brand, onAuthenticated }: { brand: PublicBrand; onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>(brand.needsSetup ? 'register' : 'login')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (brand.needsSetup) setMode('register') }, [brand.needsSetup])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (mode === 'register' && password !== confirm) {
      setError('Mật khẩu nhập lại chưa khớp.')
      return
    }
    setBusy(true)
    try {
      const body = mode === 'login'
        ? { username, password, rememberMe }
        : { username, fullName, email: email || undefined, password, rememberMe }
      const response = await authFetch(`${apiBase}/auth/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message || 'Không thể xác thực')

      // Chỉ cho vào hệ thống sau khi cookie phiên thật sự hoạt động.
      const sessionResponse = await authFetch(`${apiBase}/auth/me`, { cache: 'no-store' })
      const sessionData = await sessionResponse.json().catch(() => null)
      if (!sessionResponse.ok) {
        throw new Error(sessionData?.message || 'Đăng nhập thành công nhưng trình duyệt chưa lưu được phiên đăng nhập.')
      }

      onAuthenticated(sessionData)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xác thực')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          {brand.logoUrl ? <img src={apiAssetUrl(brand.logoUrl)} alt="Logo võ đường" /> : <div className="auth-brand-mark">空</div>}
          <div><strong>{brand.dojoName}</strong><span>{brand.slogan}</span></div>
        </div>
        {(brand.address || brand.phone || brand.email || brand.website) && (
          <div className="info-strip">
            <strong>{brand.dojoName}</strong>
            {brand.address && <><br/>Địa chỉ: {brand.address}</>}
            {brand.phone && <><br/>Điện thoại: {brand.phone}</>}
            {brand.email && <><br/>Email: {brand.email}</>}
            {brand.website && <><br/>Website: {brand.website}</>}
          </div>
        )}
        <div className="auth-copy">
          <span className="eyebrow">HỆ THỐNG QUẢN LÝ VÕ ĐƯỜNG</span>
          <h1>{mode === 'login' ? 'Đăng nhập' : brand.needsSetup ? 'Khởi tạo tài khoản chủ võ đường' : 'Đăng ký tài khoản Khách'}</h1>
          <p>{mode === 'login'
            ? 'Sử dụng tài khoản được phân quyền để truy cập hệ thống.'
            : brand.needsSetup
              ? 'Tài khoản đầu tiên sẽ trở thành Chủ võ đường và có toàn quyền.'
              : 'Tài khoản tự đăng ký mặc định nhận vai trò Khách. Chủ võ đường hoặc Quản lý phân quyền có thể cấp vai trò khác sau.'}</p>
        </div>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <>
              <label className="form-field"><span>Họ và tên *</span><input required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" /></label>
              <label className="form-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            </>
          )}
          <label className="form-field"><span>Tên đăng nhập *</span><input required minLength={3} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="username" /></label>
          <label className="form-field"><span>Mật khẩu *</span><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          {mode === 'register' && <label className="form-field"><span>Nhập lại mật khẩu *</span><input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></label>}
          <label className="auth-remember"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /> Ghi nhớ đăng nhập</label>
          <button className="primary-btn auth-submit" disabled={busy || (mode === 'register' && !brand.registrationOpen && !brand.needsSetup)}>{busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : brand.needsSetup ? 'Tạo tài khoản Chủ võ đường' : 'Đăng ký tài khoản Khách'}</button>
        </form>
        {mode === 'register' && !brand.needsSetup && !brand.registrationOpen && (
          <div className="form-warning">Đăng ký công khai hiện đang tắt. Chủ võ đường có thể bật lại tại Thiết lập → Vận hành.</div>
        )}
        <div className="auth-switch">
          {mode === 'login' && <button type="button" onClick={() => { setMode('register'); setError('') }}>Chưa có tài khoản? Register</button>}
          {mode === 'register' && !brand.needsSetup && <button type="button" onClick={() => { setMode('login'); setError('') }}>Đã có tài khoản? Đăng nhập</button>}
        </div>
        <small className="auth-note">Mật khẩu được băm bằng bcrypt; phiên đăng nhập lưu trong cookie HttpOnly.</small>
      </div>
    </div>
  )
}

type FullSettings = {
  general: { dojoName: string; shortName: string; slogan: string; address: string; phone: string; email: string; website: string; timezone: string; currency: string; logoUrl: string | null }
  appearance: { defaultTheme: 'light' | 'dark' | 'system'; accentColor: string }
  security: { allowPublicRegistration: boolean }
  operations: { absenceWarningCount: number; tuitionWarningDays: number }
  integrations?: { vietQr: boolean; zalo: boolean; jwtSecretConfigured: boolean }
}

type AccessOverview = {
  users: Array<{ id: string; username: string; fullName: string; email?: string | null; status: string; avatarUrl?: string | null; activated: boolean; roles: Array<{ id: string; code: string; name: string }> }>
  roles: Array<{ id: string; code: string; name: string; description?: string | null; userCount: number; permissions: string[] }>
  permissions: Array<{ id: string; code: string; name: string; description?: string | null }>
}

export function SettingsPanel({
  currentUser, onUserUpdated, onBrandUpdated, onAppearance,
}: {
  currentUser: AuthUser
  onUserUpdated: (user: AuthUser) => void
  onBrandUpdated: (brand: Partial<PublicBrand>) => void
  onAppearance: (theme: PublicBrand['defaultTheme'], accent: string) => void
}) {
  const [tab, setTab] = useState<'general' | 'appearance' | 'operations' | 'integrations' | 'access' | 'account'>('general')
  const [settings, setSettings] = useState<FullSettings | null>(null)
  const [access, setAccess] = useState<AccessOverview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [profile, setProfile] = useState({ fullName: currentUser.fullName, phone: currentUser.phone ?? '', email: currentUser.email ?? '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const isOwner = currentUser.roles.some((r) => r.code === 'OWNER')
  const canManageSettings = isOwner || currentUser.permissions.includes('SETTINGS_MANAGE')
  const canAccess = isOwner || currentUser.permissions.includes('ACCESS_MANAGE')
  const canIntegrationView = isOwner || canManageSettings || currentUser.permissions.includes('INTEGRATIONS_VIEW')
  const canIntegrationManage = isOwner || canManageSettings || currentUser.permissions.includes('INTEGRATIONS_MANAGE')

  const requestJson = async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const response = await authFetch(`${apiBase}${path}`, options)
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(', ') : body?.message || `API error (${response.status})`)
    return body
  }

  const load = async () => {
    setError('')
    try {
      const data = await requestJson<FullSettings>('/settings')
      const personalTheme = (localStorage.getItem('karate-theme') as FullSettings['appearance']['defaultTheme'] | null) ?? data.appearance.defaultTheme
      const personalAccent = localStorage.getItem('karate-accent') ?? data.appearance.accentColor
      setSettings({ ...data, appearance: { defaultTheme: personalTheme, accentColor: personalAccent } })
      if (canAccess) {
        const accessData = await requestJson<AccessOverview>('/auth/access')
        setAccess(accessData)
        if (!selectedRoleId && accessData.roles.length) setSelectedRoleId(accessData.roles[0].id)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được thiết lập')
    }
  }

  useEffect(() => { void load() }, [])

  const saveSettings = async (patch: Partial<FullSettings>, success: string) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const next = await requestJson<FullSettings>('/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      setSettings((current) => current ? {
        ...current,
        ...next,
        appearance: patch.appearance ? next.appearance : current.appearance,
        integrations: current.integrations,
      } : next)
      onBrandUpdated({
        dojoName: next.general.dojoName, shortName: next.general.shortName, slogan: next.general.slogan,
        logoUrl: next.general.logoUrl, defaultTheme: next.appearance.defaultTheme, accentColor: next.appearance.accentColor,
      })
      setMessage(success)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được thiết lập') }
    finally { setBusy(false) }
  }

  const uploadImage = async (file: File, path: string) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Chỉ hỗ trợ JPG, PNG hoặc WEBP')
    if (file.size > 4 * 1024 * 1024) throw new Error('Ảnh không được vượt quá 4 MB')
    const dataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Không đọc được ảnh')); r.readAsDataURL(file) })
    return requestJson<any>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) })
  }

  const selectedRole = access?.roles.find((r) => r.id === selectedRoleId) ?? null
  const permissionGroups = useMemo(() => {
    const p = access?.permissions ?? []
    const groups: Record<string, typeof p> = {}
    for (const item of p) {
      const prefix = item.code.split('_')[0]
      ;(groups[prefix] ??= []).push(item)
    }
    return groups
  }, [access])

  if (!settings) return <div className="panel">{error || 'Đang tải thiết lập...'}</div>

  return (
    <div className="settings-page-v2">
      <div className="settings-tabs">
        <button className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>Võ đường</button>
        <button className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}>Giao diện</button>
        {canManageSettings && <button className={tab === 'operations' ? 'active' : ''} onClick={() => setTab('operations')}>Vận hành</button>}
        {canIntegrationView && <button className={tab === 'integrations' ? 'active' : ''} onClick={() => setTab('integrations')}>Tích hợp</button>}
        {canAccess && <button className={tab === 'access' ? 'active' : ''} onClick={() => setTab('access')}>Tài khoản & phân quyền</button>}
        <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>Tài khoản của tôi</button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      {tab === 'general' && <div className="settings-two-col">
        <div className="panel">
          <div className="panel-title"><div><span className="eyebrow">THƯƠNG HIỆU</span><h3>Tên và logo võ đường</h3></div></div>
          <div className="brand-editor">
            <div className="brand-logo-preview">{settings.general.logoUrl ? <img src={apiAssetUrl(settings.general.logoUrl)} alt="Logo" /> : <span>空</span>}</div>
            {canManageSettings && <div className="button-row">
              <label className="secondary-btn file-button">Chọn logo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setBusy(true); try { const next = await uploadImage(file, '/settings/logo'); setSettings((s) => s ? { ...s, general: next.general } : s); onBrandUpdated({ logoUrl: next.general.logoUrl }); setMessage('Đã cập nhật logo võ đường.') } catch (r) { setError(r instanceof Error ? r.message : 'Không tải được logo') } finally { setBusy(false); e.target.value = '' } }} /></label>
              {settings.general.logoUrl && <button className="danger-btn" onClick={async () => { const next = await requestJson<FullSettings>('/settings/logo', { method: 'DELETE' }); setSettings((s) => s ? { ...s, general: next.general } : s); onBrandUpdated({ logoUrl: null }) }}>Xóa logo</button>}
            </div>}
          </div>
          <div className="form-grid">
            <label className="form-field form-field-wide"><span>Tên võ đường *</span><input disabled={!canManageSettings} value={settings.general.dojoName} onChange={(e) => setSettings({ ...settings, general: { ...settings.general, dojoName: e.target.value } })} /></label>
            <label className="form-field"><span>Tên ngắn</span><input disabled={!canManageSettings} value={settings.general.shortName} onChange={(e) => setSettings({ ...settings, general: { ...settings.general, shortName: e.target.value } })} /></label>
            <label className="form-field"><span>Khẩu hiệu</span><input disabled={!canManageSettings} value={settings.general.slogan} onChange={(e) => setSettings({ ...settings, general: { ...settings.general, slogan: e.target.value } })} /></label>
            <label className="form-field form-field-wide"><span>Địa chỉ</span><input disabled={!canManageSettings} value={settings.general.address} onChange={(e) => setSettings({ ...settings, general: { ...settings.general, address: e.target.value } })} /></label>
            <label className="form-field"><span>Điện thoại</span><input disabled={!canManageSettings} value={settings.general.phone} onChange={(e) => setSettings({ ...settings, general: { ...settings.general, phone: e.target.value } })} /></label>
            <label className="form-field"><span>Email</span><input disabled={!canManageSettings} type="email" value={settings.general.email} onChange={(e) => setSettings({ ...settings, general: { ...settings.general, email: e.target.value } })} /></label>
            <label className="form-field form-field-wide"><span>Website</span><input disabled={!canManageSettings} value={settings.general.website} onChange={(e) => setSettings({ ...settings, general: { ...settings.general, website: e.target.value } })} /></label>
          </div>
          {canManageSettings ? (
            <div className="modal-actions"><button className="primary-btn" disabled={busy} onClick={() => void saveSettings({ general: settings.general }, 'Đã lưu thông tin võ đường.')}>Lưu thông tin</button></div>
          ) : (
            <div className="info-strip">Thông tin võ đường được hiển thị cho mọi tài khoản. Bạn chỉ có quyền xem; Chủ võ đường hoặc người có quyền Thiết lập mới được chỉnh sửa.</div>
          )}
        </div>
        {canManageSettings ? (
          <div className="panel">
            <div className="panel-title"><div><span className="eyebrow">TÍCH HỢP</span><h3>Trạng thái dịch vụ</h3></div></div>
            <div className="integration-list">
              <Integration name="VietQR / ngân hàng" ok={Boolean(settings.integrations?.vietQr)} note="Dùng cho học phí và POS" />
              <Integration name="Zalo OA" ok={Boolean(settings.integrations?.zalo)} note="Nhắc lịch, học phí, đánh giá" />
              <Integration name="JWT secret" ok={Boolean(settings.integrations?.jwtSecretConfigured)} note="Nên cấu hình AUTH_JWT_SECRET khi triển khai" />
            </div>
            <div className="info-strip">Quản lý chi tiết tại tab <strong>Tích hợp</strong>. Secret chỉ được nhập một chiều, backend mã hóa và không trả giá trị thật về trình duyệt.</div>
          </div>
        ) : (
          <div className="panel">
            <div className="panel-title"><div><span className="eyebrow">LIÊN HỆ</span><h3>Thông tin võ đường</h3></div></div>
            <div className="student-detail-grid">
              <div><span>Địa chỉ</span><strong>{settings.general.address || 'Chưa cập nhật'}</strong></div>
              <div><span>Điện thoại</span><strong>{settings.general.phone || 'Chưa cập nhật'}</strong></div>
              <div><span>Email</span><strong>{settings.general.email || 'Chưa cập nhật'}</strong></div>
              <div><span>Website</span><strong>{settings.general.website || 'Chưa cập nhật'}</strong></div>
            </div>
          </div>
        )}
      </div>}

      {tab === 'appearance' && <div className="panel settings-narrow">
        <div className="panel-title"><div><span className="eyebrow">GIAO DIỆN</span><h3>Theme và màu chủ đạo</h3></div></div>
        <div className="theme-options">
          {(['light', 'dark', 'system'] as const).map((mode) => <button key={mode} className={settings.appearance.defaultTheme === mode ? 'theme-card active' : 'theme-card'} onClick={() => { const next = { ...settings.appearance, defaultTheme: mode }; setSettings({ ...settings, appearance: next }); onAppearance(mode, next.accentColor) }}><strong>{mode === 'light' ? 'Sáng' : mode === 'dark' ? 'Tối' : 'Theo hệ thống'}</strong><span>{mode === 'light' ? 'Nền sáng, dễ đọc ban ngày' : mode === 'dark' ? 'Giảm chói khi dùng ban đêm' : 'Tự theo Windows/macOS'}</span></button>)}
        </div>
        <label className="form-field settings-color"><span>Màu chủ đạo</span><div className="color-input"><input type="color" value={settings.appearance.accentColor} onChange={(e) => { const next = { ...settings.appearance, accentColor: e.target.value }; setSettings({ ...settings, appearance: next }); onAppearance(next.defaultTheme, next.accentColor) }} /><input value={settings.appearance.accentColor} onChange={(e) => setSettings({ ...settings, appearance: { ...settings.appearance, accentColor: e.target.value } })} /></div></label>
        <div className="info-strip">Theme và màu chủ đạo ở đây là thiết lập cá nhân trên trình duyệt hiện tại, áp dụng cho mọi vai trò.</div>
        <div className="modal-actions">
          <button className="primary-btn" disabled={busy} onClick={() => { onAppearance(settings.appearance.defaultTheme, settings.appearance.accentColor); setMessage('Đã lưu giao diện cá nhân.') }}>Lưu giao diện của tôi</button>
          {canManageSettings && <button className="secondary-btn" disabled={busy} onClick={() => void saveSettings({ appearance: settings.appearance }, 'Đã đặt giao diện này làm mặc định hệ thống.')}>Đặt làm mặc định hệ thống</button>}
        </div>
      </div>}

      {tab === 'operations' && canManageSettings && <div className="settings-two-col">
        <div className="panel">
          <div className="panel-title"><div><span className="eyebrow">QUY TẮC VẬN HÀNH</span><h3>Cảnh báo tự động</h3></div></div>
          <div className="form-grid">
            <label className="form-field"><span>Cảnh báo sau số buổi nghỉ liên tiếp</span><input type="number" min={1} value={settings.operations.absenceWarningCount} onChange={(e) => setSettings({ ...settings, operations: { ...settings.operations, absenceWarningCount: Number(e.target.value) } })} /></label>
            <label className="form-field"><span>Nhắc học phí trước (ngày)</span><input type="number" min={1} value={settings.operations.tuitionWarningDays} onChange={(e) => setSettings({ ...settings, operations: { ...settings.operations, tuitionWarningDays: Number(e.target.value) } })} /></label>
            <label className="form-field"><span>Múi giờ</span><select value={settings.general.timezone} onChange={(e) => setSettings({ ...settings, general: { ...settings.general, timezone: e.target.value } })}><option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option><option value="UTC">UTC</option></select></label>
            <label className="form-field"><span>Tiền tệ</span><select value={settings.general.currency} onChange={(e) => setSettings({ ...settings, general: { ...settings.general, currency: e.target.value } })}><option value="VND">VND - Việt Nam đồng</option><option value="USD">USD</option></select></label>
          </div>
          <div className="modal-actions"><button className="primary-btn" onClick={() => void saveSettings({ operations: settings.operations, general: settings.general }, 'Đã lưu quy tắc vận hành.')}>Lưu quy tắc</button></div>
        </div>
        <div className="panel"><div className="panel-title"><div><span className="eyebrow">AN TOÀN TÀI KHOẢN</span><h3>Đăng ký tài khoản</h3></div></div><label className="staff-teacher-toggle"><input type="checkbox" checked={settings.security.allowPublicRegistration} onChange={(e) => setSettings({ ...settings, security: { ...settings.security, allowPublicRegistration: e.target.checked } })}/><div><strong>Cho phép đăng ký công khai</strong><span>Tài khoản tự đăng ký sẽ nhận role Khách và không có quyền vận hành cho đến khi được phân quyền.</span></div></label><div className="modal-actions"><button className="primary-btn" onClick={() => void saveSettings({ security: settings.security }, 'Đã lưu chính sách đăng ký.')}>Lưu chính sách</button></div></div>
      </div>}


      {tab === 'integrations' && canIntegrationView && <IntegrationSettingsTab canManage={canIntegrationManage} />}

      {tab === 'access' && canAccess && access && <div className="settings-access-grid">
        <div className="panel">
          <div className="panel-title"><div><span className="eyebrow">ROLE & PERMISSION</span><h3>Quyền của từng vai trò</h3></div></div>
          <label className="form-field"><span>Vai trò</span><select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>{access.roles.map((r) => <option value={r.id} key={r.id}>{r.name} ({r.userCount})</option>)}</select></label>
          {selectedRole && <div className="permission-groups">{Object.entries(permissionGroups).map(([group, items]) => <div className="permission-group" key={group}><strong>{group}</strong>{items.map((p) => <label key={p.id}><input type="checkbox" disabled={selectedRole.code === 'OWNER'} checked={selectedRole.code === 'OWNER' || selectedRole.permissions.includes(p.code)} onChange={(e) => { setAccess((current) => current ? { ...current, roles: current.roles.map((r) => r.id === selectedRole.id ? { ...r, permissions: e.target.checked ? [...r.permissions, p.code] : r.permissions.filter((code) => code !== p.code) } : r) } : current) }} /><span>{p.name}<small>{p.code}</small></span></label>)}</div>)}</div>}
          {selectedRole && selectedRole.code !== 'OWNER' && <div className="modal-actions"><button className="primary-btn" onClick={async () => { const next = await requestJson<AccessOverview>(`/auth/roles/${selectedRole.id}/permissions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissionCodes: selectedRole.permissions }) }); setAccess(next); setMessage(`Đã cập nhật quyền cho ${selectedRole.name}.`) }}>Lưu quyền vai trò</button></div>}
        </div>
        <div className="panel">
          <div className="panel-title"><div><span className="eyebrow">TÀI KHOẢN</span><h3>Gán role và trạng thái truy cập</h3></div></div>
          <div className="access-user-list">{access.users.map((u) => <div className="access-user" key={u.id}><div className="access-user-head"><div className="mini-user-avatar">{u.avatarUrl ? <img src={apiAssetUrl(u.avatarUrl)} /> : initials(u.fullName)}</div><div><strong>{u.fullName}</strong><span>@{u.username} · {u.activated ? 'Đã kích hoạt' : 'Chưa có mật khẩu'}</span></div><select value={u.status} onChange={async (e) => { await requestJson(`/auth/users/${u.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: e.target.value }) }); await load() }}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Ngừng</option><option value="LOCKED">Khóa</option></select></div><div className="user-role-checks">{access.roles.map((r) => <label key={r.id}><input type="checkbox" checked={u.roles.some((ur) => ur.id === r.id)} onChange={async (e) => { const roleIds = e.target.checked ? [...u.roles.map((x) => x.id), r.id] : u.roles.filter((x) => x.id !== r.id).map((x) => x.id); await requestJson(`/auth/users/${u.id}/roles`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleIds }) }); await load() }} />{r.name}</label>)}</div><div className="access-user-actions"><button className="tiny-btn" onClick={async () => { const value = window.prompt(`Đặt mật khẩu mới cho ${u.fullName} (ít nhất 8 ký tự):`); if (!value) return; await requestJson(`/auth/users/${u.id}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: value }) }); setMessage('Đã đặt mật khẩu mới.'); await load() }}>Đặt mật khẩu</button></div></div>)}</div>
        </div>
      </div>}

      {tab === 'account' && <div className="settings-two-col">
        <div className="panel"><div className="panel-title"><div><span className="eyebrow">HỒ SƠ CỦA TÔI</span><h3>Thông tin cá nhân</h3></div></div><div className="account-avatar-row"><div className="account-avatar">{currentUser.avatarUrl ? <img src={apiAssetUrl(currentUser.avatarUrl)} /> : initials(currentUser.fullName)}</div><label className="secondary-btn file-button">Đổi avatar<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const updated = await uploadImage(file, '/auth/profile/avatar'); onUserUpdated(updated); setMessage('Đã đổi avatar.') } catch (r) { setError(r instanceof Error ? r.message : 'Không tải được avatar') } finally { e.target.value = '' } }} /></label>{currentUser.avatarUrl && <button className="danger-btn" onClick={async () => { const updated = await requestJson<AuthUser>('/auth/profile/avatar', { method: 'DELETE' }); onUserUpdated(updated) }}>Xóa avatar</button>}</div><div className="form-grid"><label className="form-field form-field-wide"><span>Họ tên</span><input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}/></label><label className="form-field"><span>Số điện thoại</span><input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}/></label><label className="form-field"><span>Email</span><input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })}/></label><label className="form-field form-field-wide"><span>Tên đăng nhập</span><input disabled value={currentUser.username}/></label></div><div className="modal-actions"><button className="primary-btn" onClick={async () => { const updated = await requestJson<AuthUser>('/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) }); onUserUpdated(updated); setMessage('Đã cập nhật hồ sơ.') }}>Lưu hồ sơ</button></div></div>
        <div className="panel"><div className="panel-title"><div><span className="eyebrow">BẢO MẬT</span><h3>Đổi mật khẩu</h3></div></div><div className="form-grid single"><label className="form-field"><span>Mật khẩu hiện tại</span><input type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}/></label><label className="form-field"><span>Mật khẩu mới</span><input type="password" minLength={8} value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}/></label><label className="form-field"><span>Nhập lại mật khẩu mới</span><input type="password" minLength={8} value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}/></label></div><div className="modal-actions"><button className="primary-btn" onClick={async () => { if (passwords.newPassword !== passwords.confirm) { setError('Mật khẩu nhập lại chưa khớp.'); return } await requestJson('/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }) }); setPasswords({ currentPassword: '', newPassword: '', confirm: '' }); setMessage('Đã đổi mật khẩu.') }}>Đổi mật khẩu</button></div><div className="account-role-box"><span>Vai trò hiện tại</span><strong>{currentUser.roles.map((r) => r.name).join(', ') || 'Chưa phân vai trò'}</strong><small>{currentUser.permissions.length} quyền đang được cấp</small></div></div>
      </div>}
    </div>
  )
}

function Integration({ name, ok, note }: { name: string; ok: boolean; note: string }) {
  return <div className="integration-row"><span className={ok ? 'integration-dot ok' : 'integration-dot'}></span><div><strong>{name}</strong><p>{note}</p></div><b>{ok ? 'Đã cấu hình' : 'Chưa cấu hình'}</b></div>
}

function initials(name: string) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) || '?').toUpperCase()
}
