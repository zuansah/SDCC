import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Lock, Mail, AlertCircle, Shield } from 'lucide-react';
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

  // Auto-check if user is already logged in but needs MFA
  useEffect(() => {
    if (auth.currentUser && step === 'credentials') {
      handleUserMfaCheck(auth.currentUser);
    }
  }, []);

  const handleUserMfaCheck = async (user: User) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists() || !userDoc.data().mfaEnabled) {
        // Setup MFA
        const secret = new OTPAuth.Secret({ size: 20 });
        const secretBase32 = secret.base32;
        
        await setDoc(userDocRef, {
          email: user.email,
          mfaSecret: secretBase32,
          mfaEnabled: false
        }, { merge: true });
        
        const totp = new OTPAuth.TOTP({
          issuer: 'NSM Dashboard',
          label: user.email || 'Admin',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: secret
        });
        
        setMfaSecret(secretBase32);
        setQrUri(totp.toString());
        setStep('mfa-setup');
      } else {
        // Verify MFA
        setMfaSecret(userDoc.data().mfaSecret);
        setStep('mfa-verify');
      }
    } catch (err: any) {
      console.warn("MFA check failed:", err);
      if (err.code === 'resource-exhausted' || err.code === 'unavailable' || err.message?.includes('Quota limit exceeded') || err.message?.includes('offline')) {
        if (user.email === 'zuansah.munggaran@gmail.com' || user.email === 'zuansah.munggaran@telkom.co.id') {
          // Bypass MFA during quota limit for super admins so they aren't locked out
          onMfaVerified?.();
          return;
        }
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
    setLoading(true);
    
    try {
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(mfaSecret)
      });
      
      const delta = totp.validate({ token: mfaCode, window: 1 });
      
      if (delta !== null) {
        // Success
        if (step === 'mfa-setup') {
          // Mark as enabled in DB
          const user = auth.currentUser || currentUser;
          if (user) {
            await setDoc(doc(db, 'users', user.uid), {
              mfaEnabled: true
            }, { merge: true });
          }
        }
        onMfaVerified?.();
      } else {
        setError('Invalid authenticator code. Please try again.');
      }
    } catch (err: any) {
      setError('Failed to verify code.');
    } finally {
      setLoading(false);
    }
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
                Scan this QR code with Google Authenticator or Authy to set up two-factor authentication.
              </p>
              
              <div className="flex justify-center mb-6">
                <div className="bg-white p-4 border border-slate-200 rounded-xl inline-block">
                  <QRCodeSVG value={qrUri} size={200} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 text-center">Enter 6-digit code</label>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                required
                maxLength={6}
                className="w-full text-center tracking-widest text-2xl px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors font-mono"
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
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
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                required
                maxLength={6}
                autoFocus
                className="w-full text-center tracking-widest text-2xl px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors font-mono"
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
