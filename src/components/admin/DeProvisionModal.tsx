import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Trash2, X, ShieldAlert, Key, CheckCircle2, 
  Lock, RefreshCw, UserX, Database, Globe 
} from 'lucide-react';
import { checkVaultPassword, deprovisionUser, DeprovisionResult } from '../../services/userDeprovisioning';

interface DeProvisionModalProps {
  user: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: DeprovisionResult) => void;
}

export default function DeProvisionModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: DeProvisionModalProps) {
  const [password, setPassword] = useState('');
  const [hasVaultPassword, setHasVaultPassword] = useState(false);
  const [checkingVault, setCheckingVault] = useState(true);
  const [deleteAuthAccount, setDeleteAuthAccount] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    setError(null);
    setPassword('');
    setCheckingVault(true);

    checkVaultPassword(user.uid).then((vaultPass) => {
      if (vaultPass) {
        setHasVaultPassword(true);
        setPassword(vaultPass);
      } else {
        setHasVaultPassword(false);
      }
      setCheckingVault(false);
    }).catch(() => {
      setHasVaultPassword(false);
      setCheckingVault(false);
    });
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await deprovisionUser({
        uid: user.uid,
        email: user.email,
        name: user.name,
        password: deleteAuthAccount ? password : '',
      });

      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal melakukan de-provisioning pengguna.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-rose-200 overflow-hidden relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-red-800 text-white p-6 relative">
          <button 
            type="button"
            onClick={onClose} 
            disabled={loading}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <UserX className="w-6 h-6 text-rose-200" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white mb-1">
                <ShieldAlert className="w-3 h-3 text-rose-300" />
                De-provisioning Akun
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Hapus Pengguna & Akun Auth
              </h3>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* User Details Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Nama Pengguna:</span>
              <span className="font-bold text-slate-800">{user.name || 'Unnamed User'}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Email:</span>
              <span className="font-mono font-semibold text-slate-800">{user.email}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Role:</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px]">
                {user.role}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">User UID:</span>
              <span className="font-mono text-[10.5px] text-slate-500 truncate max-w-[240px]">{user.uid}</span>
            </div>
          </div>

          {/* Scope of Deletion Checklist */}
          <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3.5 space-y-2">
            <span className="text-[11.5px] font-bold text-rose-900 block flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Tindakan de-provisioning ini akan menghapus:
            </span>
            <ul className="text-xs text-rose-800 space-y-1.5 pl-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Dokumen profil & izin di database (<strong>/users/{user.uid}</strong>)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Akun kredensial di <strong>Firebase Authentication</strong> (email akan dilepas)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Sesi aktif yang sedang berjalan di <strong>/user_sessions</strong></span>
              </li>
            </ul>
          </div>

          {/* Vault Status or Password Input */}
          {checkingVault ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Memeriksa kredensial di Auth Vault...</span>
            </div>
          ) : hasVaultPassword ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">Kredensial Terverifikasi di Auth Vault</span>
                <span className="text-[11px] text-emerald-700">
                  Akun Firebase Auth dan record Firestore akan dihapus secara otomatis.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                Password Akun Pengguna (untuk menghapus Firebase Auth):
              </label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password akun pengguna..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-rose-500 outline-none"
              />
              <p className="text-[10.5px] text-slate-500 leading-tight">
                Masukkan password akun pengguna agar akun Firebase Auth dapat dihapus sepenuhnya. Jika password tidak diketahui, record database akan tetap dihapus.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-start gap-2 text-xs text-rose-800 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="leading-snug">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sedang De-provisioning...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Konfirmasi De-provision & Hapus</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
