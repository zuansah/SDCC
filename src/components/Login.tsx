import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Lock, Mail, AlertCircle, Shield, Key, RefreshCw, ArrowLeft, Copy, Check } from 'lucide-react';
import * as OTPAuth from 'otpauth';
import { QRCodeSVG } from 'qrcode.react';
import { authFloodGuard } from '../utils/security';

interface LoginProps {
  onMfaVerified?: () => void;
}

type AuthStep = 'credentials' | 'mfa-setup' | 'mfa-verify';

export default function Login({ onMfaVerified }: LoginProps) {
  const [step, setStep] = useState<AuthStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // MFA States
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [qrUri, setQrUri] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Auto-check if user is already logged in but needs MFA
  useEffect(() => {
    if (auth.currentUser && step === 'credentials') {
      handleUserMfaCheck(auth.currentUser);
    }
  }, []);

  const handleUserMfaCheck = async (user: User, forceNew = false) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      const uData = userDoc.exists() ? userDoc.data() : null;

      // If user has MFA enabled AND has a valid secret, user MUST verify.
      // Users cannot reset or re-register MFA themselves; only Super Admin can reset it.
      if (uData?.mfaEnabled && uData?.mfaSecret) {
        setMfaSecret(uData.mfaSecret);
        setStep('mfa-verify');
        return;
      }

      // If user needs MFA setup (or if mfaSecret was reset / empty)
      // Check if there is already a generated secret in DB that hasn't been enabled yet
      let secretBase32 = (!forceNew && uData?.mfaSecret && typeof uData.mfaSecret === 'string' && uData.mfaSecret.length > 10)
        ? uData.mfaSecret
        : '';

      let secret: OTPAuth.Secret;
      if (secretBase32) {
        try {
          secret = OTPAuth.Secret.fromBase32(secretBase32);
        } catch {
          secret = new OTPAuth.Secret({ size: 20 });
          secretBase32 = secret.base32;
        }
      } else {
        secret = new OTPAuth.Secret({ size: 20 });
        secretBase32 = secret.base32;
      }

      // Persist secret and keep mfaEnabled false until verified
      await setDoc(userDocRef, {
        email: user.email,
        mfaSecret: secretBase32,
        mfaEnabled: false
      }, { merge: true });

      const totp = new OTPAuth.TOTP({
        issuer: 'NSM Telkom',
        label: user.email || 'Admin',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret
      });

      setMfaSecret(secretBase32);
      setQrUri(totp.toString());
      setStep('mfa-setup');
    } catch (err: any) {
      console.warn("MFA check failed:", err);
      if (err.code === 'resource-exhausted' || err.code === 'unavailable' || err.message?.includes('Quota limit exceeded') || err.message?.includes('offline')) {
        setError('Database quota exceeded. Login is temporarily restricted. Please try again tomorrow.');
      } else {
        setError(err.message || 'Failed to check MFA status');
      }
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Anti-Brute-Force check
    const check = authFloodGuard.checkAllowed(email);
    if (!check.allowed) {
      setError(`Account temporarily locked due to multiple failed login attempts. Please retry in ${Math.ceil(check.remainingSeconds / 60)} minute(s).`);
      return;
    }

    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      // Reset failed attempts on success
      authFloodGuard.recordSuccess(email);
      setCurrentUser(userCred.user);

      // Clean up any stale session termination so user is not immediately force-logged out
      try {
        await deleteDoc(doc(db, 'user_sessions', userCred.user.uid));
      } catch (_) {}

      await handleUserMfaCheck(userCred.user);
    } catch (err: any) {
      const failRecord = authFloodGuard.recordFailure(email);
      if (failRecord.locked) {
        setError('Too many failed attempts. Login locked for 15 minutes to protect against credential brute-forcing.');
      } else {
        setError(`${err.message || 'Authentication failed'}. (${failRecord.attemptsLeft} attempt(s) remaining before security lockout).`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCode = mfaCode.trim().replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    if (!mfaSecret) {
      setError('MFA secret not found. Please click "Re-register MFA" below.');
      return;
    }

    setLoading(true);
    
    try {
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(mfaSecret)
      });
      
      // window: 2 allows +/- 60s of clock skew tolerance
      const delta = totp.validate({ token: cleanCode, window: 2 });
      
      if (delta !== null) {
        // Success
        const user = auth.currentUser || currentUser;
        if (!user) {
          setError('Session expired. Please sign in again.');
          setStep('credentials');
          setLoading(false);
          return;
        }

        // Mark MFA as enabled in DB
        await setDoc(doc(db, 'users', user.uid), {
          mfaEnabled: true,
          mfaSecret: mfaSecret
        }, { merge: true });

        // Clean up any stale session termination
        try {
          await deleteDoc(doc(db, 'user_sessions', user.uid));
        } catch (_) {}

        onMfaVerified?.();
      } else {
        setError('Invalid authenticator code. Check that your device time is synchronized and try again.');
      }
    } catch (err: any) {
      console.error("MFA verification error:", err);
      setError(err?.message || 'Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      await auth.signOut();
    } catch (_) {}
    setStep('credentials');
    setMfaCode('');
    setError('');
    setCurrentUser(null);
  };

  const copySecretToClipboard = () => {
    if (!mfaSecret) return;
    navigator.clipboard?.writeText(mfaSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/NSM%204K%20Resolution%20Logo.jpeg" 
            alt="NSM Logo" 
            className="w-full h-auto object-contain"
          />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {step === 'credentials' && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Sign In'}
            </button>
          </form>
        )}

        {step === 'mfa-setup' && (
          <form onSubmit={handleMfaVerify} className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-900 flex items-center justify-center gap-2 mb-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Secure Your Account
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                Scan this QR code with Google Authenticator or Authy to complete two-factor authentication setup.
              </p>
              
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 border border-slate-200 rounded-xl inline-block shadow-sm">
                  {qrUri ? (
                    <QRCodeSVG value={qrUri} size={200} />
                  ) : (
                    <div className="w-[200px] h-[200px] flex items-center justify-center text-slate-400 text-xs">
                      Generating QR code...
                    </div>
                  )}
                </div>
              </div>

              {mfaSecret && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-2 text-left">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Key className="w-3.5 h-3.5 text-blue-600" /> Manual Secret Key
                    </span>
                    <button
                      type="button"
                      onClick={copySecretToClipboard}
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-xs text-slate-800 break-all select-all font-semibold tracking-wider bg-white p-1.5 rounded border border-slate-200 text-center">
                    {mfaSecret}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 text-center">Enter 6-digit verification code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                autoFocus
                className="w-full text-center tracking-widest text-2xl px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors font-mono font-bold"
                placeholder="000000"
              />
              <p className="text-xs text-slate-400 text-center mt-1">
                Enter the current 6 numbers shown in your authenticator app
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || mfaCode.trim().length !== 6}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Verifying & Activating...' : 'Verify & Continue'}
            </button>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  const u = auth.currentUser || currentUser;
                  if (u) handleUserMfaCheck(u, true);
                }}
                className="text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>New QR Code</span>
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </form>
        )}

        {step === 'mfa-verify' && (
          <form onSubmit={handleMfaVerify} className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-900 flex items-center justify-center gap-2 mb-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Two-Factor Authentication
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>

            <div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                autoFocus
                className="w-full text-center tracking-widest text-2xl px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors font-mono font-bold"
                placeholder="000000"
              />
              <p className="text-xs text-slate-400 text-center mt-1">
                Ensure device time is synchronized
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || mfaCode.trim().length !== 6}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Verifying Code...' : 'Verify Code'}
            </button>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 mb-0.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Lost Authenticator Device?</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  For enterprise security, MFA can only be reset or re-registered by a <strong>Super Admin</strong>. Please contact your system administrator to reset your MFA credentials.
                </p>
              </div>

              <div className="flex items-center justify-center text-xs">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition py-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
