import { useEffect, useState } from 'react'
import './integration-settings.css'

const apiBase = import.meta.env.VITE_API_URL ?? '/api'

type IntegrationSafe = {
  zalo: {
    enabled: boolean
    oaId: string
    appId: string
    adminUid: string
    sendUrl: string
    classReminders: boolean
    classReminderMinutes: number
    tuitionDueReminders: boolean
    tuitionDueDays: number
    tuitionDueTime: string
    overdueReminders: boolean
    overdueTime: string
    evaluationMessages: boolean
    dailyReport: boolean
    dailyReportTime: string
  }
  vietQr: {
    enabled: boolean
    mode: 'quicklink' | 'api'
    bankId: string
    accountNo: string
    accountName: string
    template: string
    tuitionPrefix: string
    salesPrefix: string
  }
  security: { masterKeyConfigured: boolean }
  secrets: {
    zalo: {
      accessTokenConfigured: boolean
      refreshTokenConfigured: boolean
      appSecretConfigured: boolean
    }
    vietQr: {
      clientIdConfigured: boolean
      apiKeyConfigured: boolean
      webhookSecretConfigured: boolean
    }
  }
}

type ZaloLog = {
  id: string
  templateKey: string
  recipient: string
  status: string
  providerId?: string | null
  error?: string | null
  sentAt?: string | null
  createdAt: string
  student?: { code: string; fullName: string } | null
}

type VietQrPreview = {
  qrImageUrl?: string | null
  amount?: number
  bankId?: string
  accountNo?: string
  accountName?: string
  addInfo?: string
  template?: string
  mode?: string
}

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...options, credentials: options?.credentials ?? 'include' })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      Array.isArray(body?.message)
        ? body.message.join(', ')
        : body?.message || `API error (${response.status})`,
    )
  }
  return body
}

function SecretState({ ok }: { ok: boolean }) {
  return <span className={ok ? 'secret-state ok' : 'secret-state'}>{ok ? '● Đã cấu hình' : '○ Chưa cấu hình'}</span>
}

export function IntegrationSettingsTab({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<IntegrationSafe | null>(null)
  const [logs, setLogs] = useState<ZaloLog[]>([])
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [zaloSecrets, setZaloSecrets] = useState({ accessToken: '', refreshToken: '', appSecret: '' })
  const [vietQrSecrets, setVietQrSecrets] = useState({ clientId: '', apiKey: '', webhookSecret: '' })
  const [testRecipient, setTestRecipient] = useState('')
  const [qrPreview, setQrPreview] = useState<VietQrPreview | null>(null)

  const load = async () => {
    setError('')
    try {
      const [settings, recent] = await Promise.all([
        apiJson<IntegrationSafe>('/settings/integrations'),
        apiJson<ZaloLog[]>('/settings/integrations/zalo/logs?limit=12').catch(() => []),
      ])
      setData(settings)
      setLogs(recent)
      if (!testRecipient && settings.zalo.adminUid) setTestRecipient(settings.zalo.adminUid)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được cấu hình tích hợp')
    }
  }

  useEffect(() => { void load() }, [])

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key); setError(''); setMessage('')
    try { await action() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Thao tác thất bại') }
    finally { setBusy('') }
  }

  const saveZalo = () => run('save-zalo', async () => {
    if (!data) return
    const secrets: Record<string, string> = {}
    if (zaloSecrets.accessToken.trim()) secrets.accessToken = zaloSecrets.accessToken.trim()
    if (zaloSecrets.refreshToken.trim()) secrets.refreshToken = zaloSecrets.refreshToken.trim()
    if (zaloSecrets.appSecret.trim()) secrets.appSecret = zaloSecrets.appSecret.trim()
    const updated = await apiJson<IntegrationSafe>('/settings/integrations/zalo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ config: data.zalo, secrets }),
    })
    setData(updated)
    setZaloSecrets({ accessToken: '', refreshToken: '', appSecret: '' })
    setMessage('Đã lưu cấu hình Zalo OA. Secret đã được mã hóa ở backend.')
  })

  const saveVietQr = () => run('save-vietqr', async () => {
    if (!data) return
    const secrets: Record<string, string> = {}
    if (vietQrSecrets.clientId.trim()) secrets.clientId = vietQrSecrets.clientId.trim()
    if (vietQrSecrets.apiKey.trim()) secrets.apiKey = vietQrSecrets.apiKey.trim()
    if (vietQrSecrets.webhookSecret.trim()) secrets.webhookSecret = vietQrSecrets.webhookSecret.trim()
    const updated = await apiJson<IntegrationSafe>('/settings/integrations/vietqr', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ config: data.vietQr, secrets }),
    })
    setData(updated)
    setVietQrSecrets({ clientId: '', apiKey: '', webhookSecret: '' })
    setMessage('Đã lưu cấu hình VietQR / ngân hàng.')
  })

  const clearSecret = (provider: 'zalo' | 'vietqr', key: string) => run(`clear-${provider}-${key}`, async () => {
    if (!data || !window.confirm('Xóa secret này khỏi hệ thống?')) return
    const endpoint = provider === 'zalo' ? 'zalo' : 'vietqr'
    const config = provider === 'zalo' ? data.zalo : data.vietQr
    const updated = await apiJson<IntegrationSafe>(`/settings/integrations/${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ config, secrets: { [key]: null } }),
    })
    setData(updated)
    setMessage('Đã xóa secret.')
  })

  const testZalo = () => run('test-zalo', async () => {
    const result = await apiJson<{ message?: string }>('/settings/integrations/zalo/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ recipient: testRecipient.trim() || undefined }),
    })
    setMessage(result.message || 'Đã gửi tin thử Zalo OA.')
    const recent = await apiJson<ZaloLog[]>('/settings/integrations/zalo/logs?limit=12').catch(() => [])
    setLogs(recent)
  })

  const testVietQr = () => run('test-vietqr', async () => {
    const result = await apiJson<{ message?: string; preview?: VietQrPreview }>('/settings/integrations/vietqr/test', { method: 'POST' })
    setQrPreview(result.preview ?? null)
    setMessage(result.message || 'VietQR hoạt động.')
  })

  if (!data) return <div className="panel">{error || 'Đang tải cấu hình tích hợp...'}</div>

  return (
    <div className="integration-settings-page">
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}
      {!data.security.masterKeyConfigured && (
        <div className="form-warning">
          Chưa có <code>INTEGRATION_MASTER_KEY</code>. Bạn vẫn xem cấu hình được nhưng phải đặt khóa này trong <code>apps/api/.env</code> trước khi lưu Access Token/API Key.
        </div>
      )}

      <div className="integration-settings-grid">
        <section className="panel integration-config-card">
          <div className="panel-title">
            <div><span className="eyebrow">ZALO OFFICIAL ACCOUNT</span><h3>Tự động nhắc & báo cáo</h3></div>
            <span className={data.secrets.zalo.accessTokenConfigured ? 'integration-health ok' : 'integration-health'}>{data.secrets.zalo.accessTokenConfigured ? 'Đã kết nối token' : 'Thiếu token'}</span>
          </div>

          <label className="staff-teacher-toggle">
            <input type="checkbox" disabled={!canManage} checked={data.zalo.enabled} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, enabled: e.target.checked } })}/>
            <div><strong>Gửi Zalo thật</strong><span>Tắt = hệ thống chạy dry-run và vẫn ghi NotificationLog.</span></div>
          </label>

          <div className="form-grid">
            <label className="form-field"><span>OA ID</span><input disabled={!canManage} value={data.zalo.oaId} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, oaId: e.target.value } })}/></label>
            <label className="form-field"><span>App ID</span><input disabled={!canManage} value={data.zalo.appId} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, appId: e.target.value } })}/></label>
            <label className="form-field"><span>Zalo UID quản trị</span><input disabled={!canManage} value={data.zalo.adminUid} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, adminUid: e.target.value } })}/></label>
            <label className="form-field form-field-wide"><span>Send URL</span><input disabled={!canManage} value={data.zalo.sendUrl} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, sendUrl: e.target.value } })}/></label>
          </div>

          <div className="integration-secret-box">
            <div><strong>Access Token</strong><SecretState ok={data.secrets.zalo.accessTokenConfigured}/></div>
            <input type="password" disabled={!canManage} placeholder={data.secrets.zalo.accessTokenConfigured ? 'Để trống để giữ token hiện tại' : 'Nhập Access Token'} value={zaloSecrets.accessToken} onChange={(e) => setZaloSecrets({ ...zaloSecrets, accessToken: e.target.value })}/>
            {canManage && data.secrets.zalo.accessTokenConfigured && <button className="tiny-btn danger-text" onClick={() => void clearSecret('zalo', 'accessToken')}>Xóa token</button>}
          </div>
          <div className="integration-secret-box">
            <div><strong>Refresh Token</strong><SecretState ok={data.secrets.zalo.refreshTokenConfigured}/></div>
            <input type="password" disabled={!canManage} placeholder="Để trống nếu chưa dùng" value={zaloSecrets.refreshToken} onChange={(e) => setZaloSecrets({ ...zaloSecrets, refreshToken: e.target.value })}/>
          </div>
          <div className="integration-secret-box">
            <div><strong>App Secret</strong><SecretState ok={data.secrets.zalo.appSecretConfigured}/></div>
            <input type="password" disabled={!canManage} placeholder="Để trống để giữ secret hiện tại" value={zaloSecrets.appSecret} onChange={(e) => setZaloSecrets({ ...zaloSecrets, appSecret: e.target.value })}/>
          </div>

          <div className="integration-automation-grid">
            <label><input type="checkbox" disabled={!canManage} checked={data.zalo.classReminders} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, classReminders: e.target.checked } })}/> Nhắc lịch học</label>
            <label className="mini-setting">Trước <input type="number" min={5} disabled={!canManage} value={data.zalo.classReminderMinutes} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, classReminderMinutes: Number(e.target.value) } })}/> phút</label>
            <label><input type="checkbox" disabled={!canManage} checked={data.zalo.tuitionDueReminders} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, tuitionDueReminders: e.target.checked } })}/> Nhắc học phí</label>
            <label className="mini-setting">Trước <input type="number" min={1} disabled={!canManage} value={data.zalo.tuitionDueDays} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, tuitionDueDays: Number(e.target.value) } })}/> ngày · <input type="time" disabled={!canManage} value={data.zalo.tuitionDueTime} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, tuitionDueTime: e.target.value } })}/></label>
            <label><input type="checkbox" disabled={!canManage} checked={data.zalo.overdueReminders} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, overdueReminders: e.target.checked } })}/> Nhắc quá hạn</label>
            <label className="mini-setting"><input type="time" disabled={!canManage} value={data.zalo.overdueTime} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, overdueTime: e.target.value } })}/></label>
            <label><input type="checkbox" disabled={!canManage} checked={data.zalo.evaluationMessages} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, evaluationMessages: e.target.checked } })}/> Gửi đánh giá mới</label>
            <span></span>
            <label><input type="checkbox" disabled={!canManage} checked={data.zalo.dailyReport} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, dailyReport: e.target.checked } })}/> Báo cáo cuối ngày</label>
            <label className="mini-setting"><input type="time" disabled={!canManage} value={data.zalo.dailyReportTime} onChange={(e) => setData({ ...data, zalo: { ...data.zalo, dailyReportTime: e.target.value } })}/></label>
          </div>

          <div className="integration-actions">
            {canManage && <button className="primary-btn" disabled={Boolean(busy)} onClick={() => void saveZalo()}>{busy === 'save-zalo' ? 'Đang lưu...' : 'Lưu Zalo OA'}</button>}
            <input className="integration-test-recipient" placeholder="UID nhận tin thử" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)}/>
            <button className="secondary-btn" disabled={Boolean(busy) || !data.secrets.zalo.accessTokenConfigured} onClick={() => void testZalo()}>{busy === 'test-zalo' ? 'Đang gửi...' : 'Gửi tin thử'}</button>
          </div>
        </section>

        <section className="panel integration-config-card">
          <div className="panel-title">
            <div><span className="eyebrow">VIETQR / NGÂN HÀNG</span><h3>QR học phí & bán hàng</h3></div>
            <span className={data.vietQr.enabled ? 'integration-health ok' : 'integration-health'}>{data.vietQr.enabled ? 'Đang bật' : 'Đang tắt'}</span>
          </div>

          <label className="staff-teacher-toggle">
            <input type="checkbox" disabled={!canManage} checked={data.vietQr.enabled} onChange={(e) => setData({ ...data, vietQr: { ...data.vietQr, enabled: e.target.checked } })}/>
            <div><strong>Bật VietQR</strong><span>Dùng chung cho hóa đơn học phí và POS.</span></div>
          </label>

          <div className="form-grid">
            <label className="form-field"><span>Chế độ</span><select disabled={!canManage} value={data.vietQr.mode} onChange={(e) => setData({ ...data, vietQr: { ...data.vietQr, mode: e.target.value as 'quicklink' | 'api' } })}><option value="quicklink">Quick Link</option><option value="api">VietQR API v2</option></select></label>
            <label className="form-field"><span>Bank ID / BIN</span><input disabled={!canManage} value={data.vietQr.bankId} onChange={(e) => setData({ ...data, vietQr: { ...data.vietQr, bankId: e.target.value } })} placeholder="VPBank hoặc 970432"/></label>
            <label className="form-field"><span>Số tài khoản</span><input disabled={!canManage} value={data.vietQr.accountNo} onChange={(e) => setData({ ...data, vietQr: { ...data.vietQr, accountNo: e.target.value } })}/></label>
            <label className="form-field"><span>Tên tài khoản</span><input disabled={!canManage} value={data.vietQr.accountName} onChange={(e) => setData({ ...data, vietQr: { ...data.vietQr, accountName: e.target.value } })}/></label>
            <label className="form-field"><span>Template</span><select disabled={!canManage} value={data.vietQr.template} onChange={(e) => setData({ ...data, vietQr: { ...data.vietQr, template: e.target.value } })}><option value="compact2">compact2</option><option value="compact">compact</option><option value="qr_only">qr_only</option><option value="print">print</option></select></label>
            <label className="form-field"><span>Tiền tố học phí</span><input disabled={!canManage} value={data.vietQr.tuitionPrefix} onChange={(e) => setData({ ...data, vietQr: { ...data.vietQr, tuitionPrefix: e.target.value } })}/></label>
            <label className="form-field"><span>Tiền tố bán hàng</span><input disabled={!canManage} value={data.vietQr.salesPrefix} onChange={(e) => setData({ ...data, vietQr: { ...data.vietQr, salesPrefix: e.target.value } })}/></label>
          </div>

          {data.vietQr.mode === 'api' && <>
            <div className="integration-secret-box"><div><strong>Client ID</strong><SecretState ok={data.secrets.vietQr.clientIdConfigured}/></div><input type="password" disabled={!canManage} placeholder="Để trống để giữ Client ID hiện tại" value={vietQrSecrets.clientId} onChange={(e) => setVietQrSecrets({ ...vietQrSecrets, clientId: e.target.value })}/></div>
            <div className="integration-secret-box"><div><strong>API Key</strong><SecretState ok={data.secrets.vietQr.apiKeyConfigured}/></div><input type="password" disabled={!canManage} placeholder="Để trống để giữ API Key hiện tại" value={vietQrSecrets.apiKey} onChange={(e) => setVietQrSecrets({ ...vietQrSecrets, apiKey: e.target.value })}/></div>
          </>}

          <div className="integration-secret-box">
            <div><strong>Webhook Secret</strong><SecretState ok={data.secrets.vietQr.webhookSecretConfigured}/></div>
            <input type="password" disabled={!canManage} placeholder="Secret bảo vệ /api/payment-webhooks/bank-transfer" value={vietQrSecrets.webhookSecret} onChange={(e) => setVietQrSecrets({ ...vietQrSecrets, webhookSecret: e.target.value })}/>
            {canManage && data.secrets.vietQr.webhookSecretConfigured && <button className="tiny-btn danger-text" onClick={() => void clearSecret('vietqr', 'webhookSecret')}>Xóa secret</button>}
          </div>

          <div className="info-strip">Quick Link không cần API key. Chế độ API v2 yêu cầu Bank ID là BIN 6 chữ số, Client ID và API Key.</div>
          <div className="integration-actions">
            {canManage && <button className="primary-btn" disabled={Boolean(busy)} onClick={() => void saveVietQr()}>{busy === 'save-vietqr' ? 'Đang lưu...' : 'Lưu VietQR'}</button>}
            <button className="secondary-btn" disabled={Boolean(busy)} onClick={() => void testVietQr()}>{busy === 'test-vietqr' ? 'Đang kiểm tra...' : 'Tạo QR thử 10.000đ'}</button>
          </div>

          {qrPreview?.qrImageUrl && <div className="vietqr-preview"><img src={qrPreview.qrImageUrl} alt="VietQR thử"/><div><strong>{qrPreview.accountName}</strong><span>{qrPreview.bankId} · {qrPreview.accountNo}</span><span>{qrPreview.addInfo}</span><span>{new Intl.NumberFormat('vi-VN').format(qrPreview.amount ?? 0)} ₫</span></div></div>}
        </section>
      </div>

      <section className="panel integration-log-panel">
        <div className="panel-title"><div><span className="eyebrow">NHẬT KÝ ZALO</span><h3>12 lần gửi gần nhất</h3></div><button className="secondary-btn" onClick={() => void load()}>Làm mới</button></div>
        <div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>Loại</th><th>Người nhận</th><th>Học viên</th><th>Trạng thái</th><th>Lỗi</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.createdAt).toLocaleString('vi-VN')}</td><td className="mono">{log.templateKey.split(':')[0]}</td><td className="mono">{log.recipient}</td><td>{log.student ? `${log.student.code} · ${log.student.fullName}` : '—'}</td><td><span className={log.status === 'SENT' ? 'integration-status sent' : log.status === 'FAILED' ? 'integration-status failed' : 'integration-status'}>{log.status}</span></td><td>{log.error || '—'}</td></tr>)}{logs.length === 0 && <tr><td colSpan={6}>Chưa có nhật ký Zalo.</td></tr>}</tbody></table></div>
      </section>
    </div>
  )
}
