import { useState, useEffect } from 'react'
import Layout from '../components/Shared/Layout'
import { settingsApi } from '../api/settings'
import { useAuth } from '../App'

const TABS = ['Departments', 'Facilities', 'Users']
const ROLES = ['admin', 'hr', 'manager', 'employee']

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── DEPARTMENTS TAB ──────────────────────────────────────────────────────────
function DepartmentsTab() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await settingsApi.getDepartments()
      setDepartments(res.data.departments)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function openAdd() { setEditing(null); setForm({ name: '', description: '' }); setError(''); setShowModal(true) }
  function openEdit(d) { setEditing(d); setForm({ name: d.name, description: d.description || '' }); setError(''); setShowModal(true) }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      if (editing) {
        await settingsApi.updateDepartment(editing.id, form)
      } else {
        await settingsApi.createDepartment(form)
      }
      setShowModal(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  async function handleToggle(d) {
    try {
      await settingsApi.updateDepartment(d.id, { active: d.active ? 0 : 1 })
      load()
    } catch (e) { console.error(e) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Manage departments used across the system</p>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          + Add Department
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {departments.map(d => (
                <tr key={d.id} className={`hover:bg-gray-50 ${!d.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                  <td className="px-4 py-3 text-gray-500">{d.description || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {d.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(d)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                    <button onClick={() => handleToggle(d)} className="text-gray-500 hover:text-gray-700 text-xs font-medium">
                      {d.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No departments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Department' : 'Add Department'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Sterile Processing" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── FACILITIES TAB ───────────────────────────────────────────────────────────
function FacilitiesTab() {
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const emptyForm = { name: '', address: '', city: '', state: '', contact_name: '', contact_email: '', contact_phone: '' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await settingsApi.getFacilities()
      setFacilities(res.data.facilities)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function openAdd() { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true) }
  function openEdit(f) {
    setEditing(f)
    setForm({ name: f.name, address: f.address || '', city: f.city || '', state: f.state || '',
      contact_name: f.contact_name || '', contact_email: f.contact_email || '', contact_phone: f.contact_phone || '' })
    setError(''); setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Facility name is required'); return }
    setSaving(true); setError('')
    try {
      if (editing) { await settingsApi.updateFacility(editing.id, form) }
      else { await settingsApi.createFacility(form) }
      setShowModal(false); load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  async function handleToggle(f) {
    try { await settingsApi.updateFacility(f.id, { active: f.active ? 0 : 1 }); load() }
    catch (e) { console.error(e) }
  }

  const field = (label, key, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Client facilities where employees are assigned</p>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          + Add Facility
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Facility Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {facilities.map(f => (
                <tr key={f.id} className={`hover:bg-gray-50 ${!f.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{f.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {[f.city, f.state].filter(Boolean).join(', ') || f.address || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <div>{f.contact_name || '—'}</div>
                    {f.contact_email && <div className="text-xs text-blue-600">{f.contact_email}</div>}
                    {f.contact_phone && <div className="text-xs">{f.contact_phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {f.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(f)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                    <button onClick={() => handleToggle(f)} className="text-gray-500 hover:text-gray-700 text-xs font-medium">
                      {f.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {facilities.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No facilities yet. Add your first client facility.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit Facility' : 'Add Facility'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. St. Mary's Hospital" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field('Address', 'address', 'text', '123 Main St')}
              {field('City', 'city', 'text', 'Chicago')}
              {field('State', 'state', 'text', 'IL')}
              {field('Contact Name', 'contact_name', 'text', 'Jane Doe')}
              {field('Contact Email', 'contact_email', 'email', 'jane@hospital.com')}
              {field('Contact Phone', 'contact_phone', 'text', '555-123-4567')}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── USERS TAB ────────────────────────────────────────────────────────────────
function UsersTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const emptyForm = { name: '', email: '', password: '', role: 'manager', department: '' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await settingsApi.getUsers()
      setUsers(res.data.users)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function openAdd() { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true) }
  function openEdit(u) {
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, department: u.department || '' })
    setError(''); setShowModal(true)
  }

  async function handleSave() {
    if (!form.name || !form.email || (!editing && !form.password)) {
      setError('Name, email' + (!editing ? ', and password' : '') + ' are required'); return
    }
    setSaving(true); setError('')
    try {
      const payload = { ...form }
      if (editing && !payload.password) delete payload.password
      if (editing) { await settingsApi.updateUser(editing.id, payload) }
      else { await settingsApi.createUser(payload) }
      setShowModal(false); load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  async function handleDelete(u) {
    if (!window.confirm(`Delete user "${u.name}"? This cannot be undone.`)) return
    try { await settingsApi.deleteUser(u.id); load() }
    catch (err) { alert(err.response?.data?.error || 'Failed to delete') }
  }

  const roleBadge = (role) => ({
    admin: 'bg-purple-100 text-purple-700',
    hr: 'bg-blue-100 text-blue-700',
    manager: 'bg-green-100 text-green-700',
    employee: 'bg-gray-100 text-gray-600'
  }[role] || 'bg-gray-100 text-gray-600')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Manage HR users, managers, and admin accounts</p>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          + Add User
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {u.name} {u.id === currentUser?.id && <span className="text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleBadge(u.role)}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.department || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                    {u.id !== currentUser?.id && (
                      <button onClick={() => handleDelete(u)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Edit User' : 'Add User'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editing && <span className="text-gray-400 font-normal">(leave blank to keep)</span>}
                  {!editing && <span className="text-red-500"> *</span>}
                </label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input type="text" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── MAIN SETTINGS PAGE ───────────────────────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState('Departments')

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage departments, facilities, and system users</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'Departments' && '🏢 '}
                {tab === 'Facilities' && '🏥 '}
                {tab === 'Users' && '👤 '}
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {activeTab === 'Departments' && <DepartmentsTab />}
          {activeTab === 'Facilities' && <FacilitiesTab />}
          {activeTab === 'Users' && <UsersTab />}
        </div>
      </div>
    </Layout>
  )
}
