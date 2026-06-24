import React, { useState, useEffect } from "react";
import { auth } from "../services/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { Phone, Lock, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";

export default function LoginPortal({ onLoginSuccess }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Clean up reCAPTCHA verifier on unmount
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        } catch (e) {
          console.error("Error clearing recaptcha:", e);
        }
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) return;
    
    try {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {
          // reCAPTCHA solved
        },
        "expired-callback": () => {
          setError("reCAPTCHA expired. Please try again.");
          if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
          }
        }
      });
    } catch (err) {
      console.error("Error setting up reCAPTCHA:", err);
      setError("Failed to initialize security verifier. Please refresh the page.");
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setError("");

    // Automatically append India (+91) country code for testing.
    // If country code is already typed, use as is.
    let fullNumber = phoneNumber.trim();
    if (!fullNumber.startsWith("+")) {
      fullNumber = `+91${fullNumber}`;
    }

    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, fullNumber, appVerifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
    } catch (err) {
      console.error("Error sending SMS:", err);
      setError("Failed to send OTP code. Please check your connection and phone format.");
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        } catch (e) {
          // ignore
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await confirmationResult.confirm(otpCode);
      onLoginSuccess(result.user);
    } catch (err) {
      console.error("Error verifying OTP:", err);
      setError("Invalid OTP code. Please double-check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setOtpSent(false);
    setOtpCode("");
    setConfirmationResult(null);
    setError("");
  };

  return (
    <div className="h-full flex flex-col justify-center bg-zinc-950 px-6 py-12 relative overflow-hidden select-none safe-bottom">
      {/* Invisible recaptcha hook container */}
      <div id="recaptcha-container"></div>

      {/* Decorative background grid effects */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
      </div>

      <div className="w-full flex flex-col gap-6 z-10 animate-fade-in">
        {/* Title branding banner */}
        <div className="flex flex-col items-center text-center gap-2 mb-2">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-3xl shadow-lg ring-4 ring-emerald-600/20">
            F
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight mt-2">FixMyCity</h2>
          <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
            Verify your phone number to report local issues, join verifications, and earn level achievements.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-950/20 border border-rose-800/30 text-rose-400 rounded-xl text-xs flex gap-2.5 items-start">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-normal">{error}</span>
          </div>
        )}

        {/* Step 1: Input Phone Screen */}
        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Mobile Number
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-zinc-400 text-sm font-semibold border-r border-zinc-800 pr-2.5 mr-2 bg-transparent">
                  +91
                </div>
                <input
                  type="tel"
                  pattern="[0-9]{10}"
                  placeholder="Enter 10-digit mobile"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  disabled={loading}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl pl-16 pr-4 py-3.5 text-sm text-zinc-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder-zinc-600 font-mono font-bold"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phoneNumber.length < 10}
              className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating SMS...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  Send Verification OTP
                </>
              )}
            </button>
          </form>
        ) : (
          /* Step 2: Input OTP Verification Screen */
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <button
              type="button"
              onClick={handleBackToPhone}
              className="self-start flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-xs font-semibold mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Change Phone Number
            </button>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                6-Digit Verification Code
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  pattern="[0-9]{6}"
                  placeholder="Enter 6-digit OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={loading}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3.5 text-sm text-zinc-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder-zinc-600 font-mono tracking-widest text-center text-lg font-bold"
                  required
                />
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 italic text-center">
              Enter the OTP sent to your registered mobile number.
            </p>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying OTP...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm and Log In
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
