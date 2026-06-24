import React, { useState, useEffect } from "react";
import { 
  subscribeToIssues, 
  firebaseInitialized,
  auth,
  syncUserProfile
} from "./services/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { triageCivicImage, isGeminiConfigured } from "./services/gemini";
import CameraCapture from "./components/CameraCapture";
import CitizenPortal from "./components/CitizenPortal";
import AdminPortal from "./components/AdminPortal";
import LoginPortal from "./components/LoginPortal";
import { AlertCircle, Terminal, Loader2 } from "lucide-react";

export default function App() {
  // Routing State
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  
  // App States
  const [issues, setIssues] = useState([]);
  const [gpsLocation, setGpsLocation] = useState(null);
  
  // Authentication state
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Camera trigger state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState("citizen"); // citizen (report) or admin (resolve proof)
  
  // Triage state
  const [capturedImage, setCapturedImage] = useState(null);
  const [isTriageLoading, setIsTriageLoading] = useState(false);
  const [aiTriageResult, setAiTriageResult] = useState(null);
  
  // Admin upload proof state
  const [adminCapturedImage, setAdminCapturedImage] = useState(null);

  // User Profile state (persisted via localStorage)
  const [userId, setUserId] = useState("");
  const [userProfile, setUserProfile] = useState({
    name: "City Protector",
    email: "citizen@fixmycity.org",
    xp: 0,
    level: 1
  });

  // Verify key environment variables
  const isEnvConfigured = 
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY && 
    import.meta.env.VITE_FIREBASE_API_KEY && 
    import.meta.env.VITE_FIREBASE_PROJECT_ID;

  // Initialize client profile and fetch geolocation on boot
  useEffect(() => {
    // 1. Manage user profile storage
    let storedId = localStorage.getItem("fix_my_city_user_id");
    let storedProfile = localStorage.getItem("fix_my_city_profile");
    
    if (!storedId) {
      storedId = `usr_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem("fix_my_city_user_id", storedId);
    }
    setUserId(storedId);

    if (storedProfile) {
      setUserProfile(JSON.parse(storedProfile));
    } else {
      const defaultProfile = {
        name: `Citizen #${Math.floor(1000 + Math.random() * 9000)}`,
        email: "citizen@fixmycity.org",
        xp: 0,
        level: 1
      };
      setUserProfile(defaultProfile);
      localStorage.setItem("fix_my_city_profile", JSON.stringify(defaultProfile));
    }

    // 2. Fetch coordinates
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation(position.coords);
          console.log("GPS Location Loaded:", position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn("GPS tracking denied/unavailable:", error.message);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Listen for user Authentication state changes
  useEffect(() => {
    if (firebaseInitialized && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoadingAuth(false);
        if (firebaseUser) {
          // Format phone number to clean up display name if unset
          const cleanPhone = firebaseUser.phoneNumber || "";
          setUserProfile((prev) => {
            const updated = {
              ...prev,
              name: prev.name.startsWith("Citizen #") 
                ? `Citizen (${cleanPhone.slice(-4) || "Verified"})` 
                : prev.name,
              email: firebaseUser.email || `${firebaseUser.uid.slice(0, 8)}@fixmycity.org`
            };
            localStorage.setItem("fix_my_city_profile", JSON.stringify(updated));
            return updated;
          });
          setUserId(firebaseUser.uid);
        }
      });
      return () => unsubscribe();
    } else {
      setLoadingAuth(false);
    }
  }, []);

  // Set up real-time database listener when configuration is valid
  useEffect(() => {
    if (firebaseInitialized) {
      const unsubscribe = subscribeToIssues((updatedIssues) => {
        setIssues(updatedIssues);
      });
      return () => unsubscribe();
    }
  }, []);

  // Sync profile to Firestore
  useEffect(() => {
    if (userId && userProfile && firebaseInitialized) {
      syncUserProfile(userId, userProfile).catch((err) => {
        console.error("Failed to sync user profile to Firestore:", err);
      });
    }
  }, [userId, userProfile]);

  // Simple client-side Router logic
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    const handleHashChange = () => {
      if (window.location.hash === "#/admin") {
        setCurrentPath("/admin");
      } else if (window.location.hash === "" || window.location.hash === "#/") {
        setCurrentPath("/");
      }
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleHashChange);
    
    // Run initial hash verification
    handleHashChange();

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Award XP helper
  const handleAddXp = (amount) => {
    setUserProfile((prev) => {
      const newXp = prev.xp + amount;
      // 500 XP required per level increments
      const nextLevelThreshold = prev.level * 500;
      const leveledUp = newXp >= nextLevelThreshold;
      const newLevel = leveledUp ? prev.level + 1 : prev.level;
      
      const updated = {
        ...prev,
        xp: newXp,
        level: newLevel
      };
      
      localStorage.setItem("fix_my_city_profile", JSON.stringify(updated));
      return updated;
    });
  };

  // Triggers WebRTC Camera capture
  const handleTriggerCamera = (mode) => {
    setCameraMode(mode);
    setShowCamera(true);
  };

  // Image Captured Callback
  const handleCameraCapture = async (base64Image) => {
    setShowCamera(false);
    
    if (cameraMode === "citizen") {
      setCapturedImage(base64Image);
      setIsTriageLoading(true);
      
      try {
        const triageData = await triageCivicImage(base64Image);
        setAiTriageResult(triageData);
      } catch (e) {
        console.error("AI Analysis failed:", e);
      } finally {
        setIsTriageLoading(false);
      }
    } else {
      // Admin resolution mode proof
      setAdminCapturedImage(base64Image);
    }
  };

  const handleResetTriage = () => {
    setCapturedImage(null);
    setAiTriageResult(null);
  };

  // Log out the citizen
  const handleSignOut = async () => {
    if (firebaseInitialized && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Sign out failed:", err);
      }
    }
  };

  // Redirect admin back to citizen hub
  const handleAdminExit = () => {
    window.location.hash = "#/";
    setCurrentPath("/");
  };

  // Render developer credentials warning overlay
  if (!isEnvConfigured) {
    return (
      <div className="h-screen w-screen bg-[#09090b] flex flex-col justify-center items-center p-6 text-zinc-100 font-sans">
        <div className="max-w-md w-full border border-zinc-800 bg-[#0c0c0f] rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-center">
          <AlertCircle className="w-14 h-14 text-rose-500 mx-auto animate-pulse" />
          <h2 className="text-lg font-extrabold tracking-tight">Developer Setup Required</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Please configure your API keys by creating a <code className="bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded font-mono text-rose-400">.env</code> file in the project root directory. Use the template in <code className="font-mono text-zinc-300">.env.example</code>.
          </p>
          
          <div className="text-left bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex flex-col gap-2 font-mono text-[10px] text-zinc-500">
            <div className="flex items-center gap-2 mb-1 border-b border-zinc-900 pb-1.5 text-zinc-400 font-bold">
              <Terminal className="w-3.5 h-3.5" />
              <span>REQUIRED PARAMETERS:</span>
            </div>
            <div>VITE_GEMINI_API_KEY=...</div>
            <div>VITE_GOOGLE_MAPS_API_KEY=...</div>
            <div>VITE_FIREBASE_API_KEY=...</div>
            <div>VITE_FIREBASE_PROJECT_ID=...</div>
          </div>
          
          <span className="text-[10px] text-zinc-600 italic">
            Restart the dev server once keys are saved in the .env file.
          </span>
        </div>
      </div>
    );
  }

  // --- RENDER APP IN MOCKUP MOBILE CONTAINER FOR WIDE SCREENS ---
  const renderAppContent = () => {
    if (loadingAuth) {
      return (
        <div className="h-full w-full bg-[#09090b] flex flex-col justify-center items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <span className="text-zinc-500 text-xs font-semibold">Loading App Credentials...</span>
        </div>
      );
    }

    if (!user) {
      return (
        <LoginPortal onLoginSuccess={(u) => setUser(u)} />
      );
    }

    if (showCamera) {
      return (
        <CameraCapture 
          onCapture={handleCameraCapture} 
          onClose={() => setShowCamera(false)} 
        />
      );
    }

    if (currentPath === "/admin") {
      return (
        <AdminPortal 
          issues={issues}
          onLogOut={handleAdminExit}
          onTriggerCamera={() => handleTriggerCamera("admin")}
          adminCapturedImage={adminCapturedImage}
          onResetAdminCapture={() => setAdminCapturedImage(null)}
        />
      );
    }

    // Default: Citizen Dashboard
    return (
      <CitizenPortal 
        issues={issues}
        gpsLocation={gpsLocation}
        onTriggerCamera={() => handleTriggerCamera("citizen")}
        capturedImage={capturedImage}
        aiTriageResult={aiTriageResult}
        isTriageLoading={isTriageLoading}
        onResetTriage={handleResetTriage}
        userId={userId}
        userProfile={userProfile}
        onAddXp={handleAddXp}
        onSignOut={handleSignOut}
      />
    );
  };

  return (
    <div className="mock-phone-container">
      <div className="mock-phone-frame">
        {renderAppContent()}
      </div>
    </div>
  );
}
