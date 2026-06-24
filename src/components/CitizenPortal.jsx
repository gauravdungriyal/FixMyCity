import React, { useState, useEffect, useRef } from "react";
import { 
  GoogleMap, 
  useJsApiLoader, 
  Marker, 
  InfoWindow 
} from "@react-google-maps/api";
import { 
  MapPin, 
  List, 
  Trophy, 
  User, 
  AlertTriangle, 
  Clock, 
  ThumbsUp, 
  MessageSquare, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  Plus, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { 
  createIssue, 
  uploadIssueImage, 
  verifyIssue, 
  addComment,
  firebaseInitialized,
  subscribeToLeaderboard
} from "../services/firebase";
import { CIVIC_CATEGORIES, isGeminiConfigured } from "../services/gemini";

// Map container size
const mapContainerStyle = {
  width: "100%",
  height: "100%"
};

// Default coordinates centered on a general local neighborhood (e.g. Delhi, India or user coordinates)
const defaultCenter = {
  lat: 28.6139,
  lng: 77.2090
};

export default function CitizenPortal({ 
  issues, 
  gpsLocation, 
  onTriggerCamera, 
  capturedImage, 
  aiTriageResult, 
  isTriageLoading, 
  onResetTriage,
  userId,
  userProfile,
  onAddXp,
  onSignOut
}) {
  const [activeTab, setActiveTab] = useState("map"); // map, feed, leaderboard, profile
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  
  // Triage report form state
  const [triageCategory, setTriageCategory] = useState("");
  const [triageDescription, setTriageDescription] = useState("");
  const [triageUrgency, setTriageUrgency] = useState("Medium");
  const [triageCoords, setTriageCoords] = useState(defaultCenter);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [submitError, setSubmitError] = useState("");
  
  // Google Map options
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [activeMarkerInfo, setActiveMarkerInfo] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  
  const commentEndRef = useRef(null);

  // Load Google Maps script
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
  });

  // Sync GPS location to map center and triage coordinates
  useEffect(() => {
    if (gpsLocation) {
      const coords = { lat: gpsLocation.latitude, lng: gpsLocation.longitude };
      setMapCenter(coords);
      setTriageCoords(coords);
    }
  }, [gpsLocation]);

  // Subscribe to real-time leaderboard
  useEffect(() => {
    if (firebaseInitialized) {
      const unsubscribe = subscribeToLeaderboard((updatedLeaderboard) => {
        setLeaderboard(updatedLeaderboard);
      });
      return () => unsubscribe();
    }
  }, []);

  // Set initial form values when Gemini triage completes
  useEffect(() => {
    if (aiTriageResult) {
      setTriageCategory(aiTriageResult.category || CIVIC_CATEGORIES[0]);
      setTriageDescription(aiTriageResult.description || "");
      setTriageUrgency(aiTriageResult.urgency || "Medium");
    }
  }, [aiTriageResult]);

  // Scroll details chat comments to bottom
  useEffect(() => {
    if (commentEndRef.current) {
      commentEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedIssue?.comments]);

  // Handle map pin dragging when reporting
  const handleMarkerDragEnd = (event) => {
    if (event.latLng) {
      setTriageCoords({
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      });
    }
  };

  // Submit the report to Firebase
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!firebaseInitialized) {
      setSubmitError("Firebase database not connected.");
      return;
    }
    if (!capturedImage) {
      setSubmitError("No capture photo available.");
      return;
    }

    setIsSubmittingReport(true);
    setSubmitError("");

    try {
      // 1. Upload photo to storage
      const fileName = `issue_${Date.now()}.jpg`;
      const photoUrl = await uploadIssueImage(capturedImage, fileName);

      // 2. Write details document to Firestore
      const newReport = {
        category: triageCategory,
        description: triageDescription,
        urgency: triageUrgency,
        photoUrl: photoUrl,
        latitude: triageCoords.lat,
        longitude: triageCoords.lng,
        createdBy: userProfile.name || "Anonymous Citizen",
        creatorEmail: userProfile.email || "anonymous@community.org",
        creatorId: userId
      };

      await createIssue(newReport);
      
      // 3. Award XP points
      onAddXp(100);

      // Reset states
      onResetTriage();
      setActiveTab("map");
    } catch (err) {
      console.error("Submit report error:", err);
      setSubmitError("Failed to submit issue. Please check network connection.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Upvote/Verify issue
  const handleVerify = async (issueId) => {
    if (selectedIssue.verifiedUsers?.includes(userId)) return;
    try {
      await verifyIssue(issueId, userId);
      onAddXp(25);
      
      // Local state update for smooth UX
      setSelectedIssue(prev => ({
        ...prev,
        verificationsCount: prev.verificationsCount + 1,
        verifiedUsers: [...(prev.verifiedUsers || []), userId]
      }));
    } catch (err) {
      console.error("Error upvoting issue:", err);
    }
  };

  // Submit a comment
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    try {
      const commentObj = {
        userName: userProfile.name || "Anonymous Citizen",
        userId: userId,
        text: newCommentText.trim()
      };

      const added = await addComment(selectedIssue.id, commentObj);
      
      setSelectedIssue(prev => ({
        ...prev,
        comments: [...(prev.comments || []), added]
      }));
      setNewCommentText("");
    } catch (err) {
      console.error("Error posting comment:", err);
    }
  };

  // Dynamic status-colored markers
  const getMarkerIcon = (status) => {
    let pinColor = "EF4444"; // Red
    if (status === "In Progress") pinColor = "F59E0B"; // Yellow/Orange
    if (status === "Resolved") pinColor = "10B981"; // Green
    
    return {
      url: `https://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|${pinColor}`,
      scaledSize: isLoaded ? new window.google.maps.Size(26, 40) : null
    };
  };

  // Render maps markers
  const renderMarkers = () => {
    return issues.map((issue) => {
      if (!issue.latitude || !issue.longitude) return null;
      return (
        <Marker
          key={issue.id}
          position={{ lat: issue.latitude, lng: issue.longitude }}
          icon={getMarkerIcon(issue.status)}
          onClick={() => {
            setActiveMarkerInfo(issue);
            setMapCenter({ lat: issue.latitude, lng: issue.longitude });
          }}
        />
      );
    });
  };

  return (
    <div className="h-full flex flex-col relative bg-zinc-50 dark:bg-[#09090b]">
      {/* Subpage Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] z-10 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
            F
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">FixMyCity</h1>
            <p className="text-[10px] text-zinc-400 font-medium tracking-wide uppercase">Hyperlocal Triage</p>
          </div>
        </div>
        {/* XP level badge */}
        <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40">
          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">Lvl {userProfile.level}</span>
          <div className="w-8 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full" 
              style={{ width: `${(userProfile.xp / (userProfile.level * 500)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Tab Viewports */}
      <div className="flex-1 relative overflow-hidden">
        
        {/* Triage wizard overlay */}
        {(capturedImage || isTriageLoading) && (
          <div className="absolute inset-0 bg-white dark:bg-[#09090b] z-40 flex flex-col overflow-y-auto animate-slide-up pb-10">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] sticky top-0 z-10">
              <h2 className="text-sm font-extrabold uppercase text-zinc-800 dark:text-zinc-200">
                Civic Triage Wizard
              </h2>
              <button 
                onClick={onResetTriage}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>

            {isTriageLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-50 dark:bg-[#09090b]">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                <h3 className="font-bold text-zinc-800 dark:text-zinc-200 mb-2">Analyzing Capture Image</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-xs leading-relaxed">
                  Gemini 1.5 Flash is scanning for potholes, trash, leaks, or public toilet blockages...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="p-5 flex flex-col gap-5">
                {submitError && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Snapped image thumbnail */}
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black">
                  <img src={capturedImage} alt="Triage Thumbnail" className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Capture Approved
                  </div>
                </div>

                {/* Interactive Drag Marker Map */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Pin Location (Drag marker to adjust)
                  </span>
                  <div className="h-44 w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative bg-zinc-100 dark:bg-zinc-900">
                    {isLoaded ? (
                      <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={triageCoords}
                        zoom={16}
                        options={{
                          disableDefaultUI: true,
                          zoomControl: false,
                          gestureHandling: "cooperative"
                        }}
                      >
                        <Marker 
                          position={triageCoords} 
                          draggable={true} 
                          onDragEnd={handleMarkerDragEnd} 
                        />
                      </GoogleMap>
                    ) : loadError ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                        <AlertTriangle className="w-8 h-8 text-amber-500 mb-1" />
                        <span className="text-xs text-zinc-500">Google Maps failed to load. Check API Key.</span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 italic">
                    Coordinates: {triageCoords.lat.toFixed(5)}, {triageCoords.lng.toFixed(5)}
                  </span>
                </div>

                {/* Form Inputs */}
                <div className="flex flex-col gap-4">
                  {/* Category select dropdown */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Problem Category
                    </label>
                    <select
                      value={triageCategory}
                      onChange={(e) => setTriageCategory(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-950 dark:text-zinc-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      required
                    >
                      {CIVIC_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Urgency/Severity */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      AI Estimated Urgency
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Low", "Medium", "High"].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setTriageUrgency(level)}
                          className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                            triageUrgency === level
                              ? level === "High"
                                ? "bg-rose-50 dark:bg-rose-950/20 border-rose-500 text-rose-600 dark:text-rose-400"
                                : level === "Medium"
                                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500 text-amber-600 dark:text-amber-400"
                                : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Problem Description
                    </label>
                    <textarea
                      value={triageDescription}
                      onChange={(e) => setTriageDescription(e.target.value)}
                      rows={3}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-950 dark:text-zinc-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-zinc-400"
                      placeholder="Describe the issue in detail..."
                      required
                    ></textarea>
                  </div>
                </div>

                {/* Submitting buttons */}
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSubmittingReport ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading & Registering...
                    </>
                  ) : (
                    <>Submit Triage Report (+100 XP)</>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 1: Google Map Full-bleed */}
        {activeTab === "map" && (
          <div className="w-full h-full relative">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={14}
                options={{
                  disableDefaultUI: true,
                  zoomControl: false,
                  styles: [
                    {
                      featureType: "poi",
                      elementType: "labels",
                      stylers: [{ visibility: "off" }]
                    }
                  ]
                }}
              >
                {renderMarkers()}

                {/* Marker click preview Popup */}
                {activeMarkerInfo && (
                  <InfoWindow
                    position={{ lat: activeMarkerInfo.latitude, lng: activeMarkerInfo.longitude }}
                    onCloseClick={() => setActiveMarkerInfo(null)}
                  >
                    <div className="p-1 max-w-[200px] flex flex-col gap-1.5 text-zinc-900">
                      <img 
                        src={activeMarkerInfo.photoUrl} 
                        alt="Issue Preview" 
                        className="w-full h-24 object-cover rounded-md" 
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-600">
                          {activeMarkerInfo.status}
                        </span>
                        <h4 className="text-xs font-bold truncate">{activeMarkerInfo.category}</h4>
                        <p className="text-[10px] text-zinc-500 truncate">{activeMarkerInfo.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedIssue(activeMarkerInfo);
                          setShowDetailPanel(true);
                          setActiveMarkerInfo(null);
                        }}
                        className="mt-1 w-full bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-bold py-1.5 rounded-md text-center"
                      >
                        Open Full Details
                      </button>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            ) : loadError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-500 mb-4 animate-pulse" />
                <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-300 mb-2">Google Maps Initialization Failed</h3>
                <p className="text-xs text-zinc-500 max-w-xs">
                  Please verify your VITE_GOOGLE_MAPS_API_KEY environment variable is configured in .env.
                </p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-[#09090b]">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              </div>
            )}
            
            {/* Quick map floating banner */}
            <div className="absolute top-4 left-4 right-4 glassmorphism rounded-xl p-3 flex justify-between items-center z-10">
              <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                🔴 Reported &nbsp; 🟡 In Progress &nbsp; 🟢 Resolved
              </span>
              <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                {issues.length} Tickets
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: Activity List Feed */}
        {activeTab === "feed" && (
          <div className="w-full h-full overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {issues.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-70">
                <MapPin className="w-10 h-10 text-zinc-400 mb-2" />
                <span className="text-sm font-semibold text-zinc-500">No issues reported yet.</span>
              </div>
            ) : (
              issues.map((issue) => (
                <div 
                  key={issue.id}
                  onClick={() => {
                    setSelectedIssue(issue);
                    setShowDetailPanel(true);
                  }}
                  className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden p-3.5 flex gap-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-98 cursor-pointer shadow-xs"
                >
                  <img 
                    src={issue.photoUrl} 
                    alt={issue.category} 
                    className="w-20 h-20 rounded-xl object-cover shrink-0 border border-zinc-100 dark:border-zinc-900" 
                  />
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          issue.status === "Resolved" 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : issue.status === "In Progress"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                        }`}>
                          {issue.status}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {formatDistanceToNow(issue.createdAt, { addSuffix: true })}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold truncate text-zinc-900 dark:text-zinc-50">{issue.category}</h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">{issue.description}</p>
                    </div>
                    
                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-bold mt-1">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-emerald-500" />
                        {issue.verificationsCount || 0} Verifications
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-blue-500" />
                        {issue.comments?.length || 0} Comments
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Leaderboard */}
        {activeTab === "leaderboard" && (
          <div className="w-full h-full overflow-y-auto px-4 py-4 flex flex-col gap-4">
            <div className="bg-emerald-600 text-white rounded-2xl p-5 shadow-md flex flex-col gap-2 relative overflow-hidden">
              <div className="absolute right-[-10px] bottom-[-20px] opacity-10">
                <Trophy className="w-40 h-40" />
              </div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-emerald-100">Top Civic Guardians</h3>
              <p className="text-2xl font-black">Weekly Champions</p>
              <p className="text-[11px] text-emerald-100/90 leading-relaxed max-w-[80%]">
                Earn 100 XP for submitting issue reports and 25 XP for upvoting / verifying nearby reports.
              </p>
            </div>

            {/* Live Leaderboard Standings from Firestore */}
            <div className="flex flex-col gap-2">
              {leaderboard.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-400 font-medium">
                  No other active users yet. Be the first!
                </div>
              ) : (
                leaderboard.map((item, idx) => {
                  const isSelf = item.userId === userId;
                  const badgeName = item.badge || (
                    item.xp >= 1000 ? "Grand Guardian" :
                    item.xp >= 500 ? "Local Legend" :
                    item.xp >= 250 ? "Civic Sleuth" : "First Responder"
                  );
                  return (
                    <div 
                      key={item.userId || idx}
                      className={`border rounded-2xl p-3 flex items-center justify-between transition-all ${
                        isSelf 
                          ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/40" 
                          : "bg-white dark:bg-[#0c0c0f] border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          idx === 0 
                            ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                            : idx === 1
                            ? "bg-slate-100 text-slate-800 border border-slate-300"
                            : idx === 2
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "text-zinc-400"
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold truncate">
                            {item.name} {isSelf && <span className="text-[10px] text-emerald-500 font-extrabold">(You)</span>}
                          </span>
                          <span className="text-[10px] text-zinc-400">{badgeName}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">{item.xp} XP</div>
                        <div className="text-[9px] font-bold text-zinc-400">Level {item.level}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Profile Tab */}
        {activeTab === "profile" && (
          <div className="w-full h-full overflow-y-auto px-4 py-4 flex flex-col gap-5">
            {/* Avatar header card */}
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col items-center text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-emerald-600 text-white text-3xl font-extrabold flex items-center justify-center mb-3">
                {userProfile.name ? userProfile.name[0] : "C"}
              </div>
              <h3 className="font-extrabold text-base">{userProfile.name}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">{userProfile.email}</p>

              {/* Progress metrics */}
              <div className="grid grid-cols-3 gap-2 w-full border-t border-zinc-100 dark:border-zinc-900 mt-5 pt-4">
                <div className="flex flex-col">
                  <span className="text-base font-extrabold text-zinc-800 dark:text-zinc-100">
                    {issues.filter(i => i.creatorId === userId).length}
                  </span>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Reports</span>
                </div>
                <div className="flex flex-col border-x border-zinc-100 dark:border-zinc-900">
                  <span className="text-base font-extrabold text-zinc-800 dark:text-zinc-100">
                    {userProfile.level}
                  </span>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Lvl Rank</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-extrabold text-zinc-800 dark:text-zinc-100">
                    {userProfile.xp}
                  </span>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Total XP</span>
                </div>
              </div>
            </div>

            {/* Badges card */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Unlocked Achievements</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { title: "First Responder", desc: "Report 1st issue", unlocked: issues.filter(i => i.creatorId === userId).length >= 1 },
                  { title: "Civic Sleuth", desc: "Report 3+ issues", unlocked: issues.filter(i => i.creatorId === userId).length >= 3 },
                  { title: "Water Warden", desc: "Upvote water report", unlocked: userProfile.xp >= 25 },
                  { title: "Local Legend", desc: "Reach 500+ XP", unlocked: userProfile.xp >= 500 }
                ].map((badge) => (
                  <div 
                    key={badge.title}
                    className={`border rounded-2xl p-3 flex flex-col justify-between h-20 transition-all ${
                      badge.unlocked 
                        ? "bg-white dark:bg-[#0c0c0f] border-emerald-500/30 shadow-xs" 
                        : "bg-zinc-100/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800/80 opacity-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">{badge.title}</span>
                      {badge.unlocked ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400">{badge.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hidden admin access portal */}
            <div className="mt-6 flex flex-col items-center border-t border-zinc-100 dark:border-zinc-900 pt-6">
              <p className="text-[10px] text-zinc-400 text-center mb-2">
                Municipal maintenance workers can log in to claim tickets.
              </p>
              <a 
                href="/admin"
                className="text-xs font-bold text-zinc-400 hover:text-emerald-500 transition-colors uppercase tracking-wider mb-4"
              >
                Access Administration Terminal
              </a>
              
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-300 py-3 px-4 rounded-xl text-xs font-bold transition-all border border-zinc-200 dark:border-zinc-800 shadow-sm"
                >
                  Log Out of Account
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating sliding Details Drawer for Issues */}
      {showDetailPanel && selectedIssue && (
        <div className="absolute inset-0 bg-black/60 z-30 flex flex-col justify-end">
          <div 
            className="w-full h-[85%] bg-white dark:bg-[#09090b] rounded-t-3xl overflow-hidden flex flex-col animate-slide-up relative safe-bottom"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f]">
              <span className="text-[10px] font-extrabold uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
                {selectedIssue.status}
              </span>
              <button 
                onClick={() => { setShowDetailPanel(false); setSelectedIssue(null); }}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details scrolling content */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* Category & Date */}
              <div>
                <h3 className="text-base font-extrabold leading-tight text-zinc-950 dark:text-zinc-50">
                  {selectedIssue.category}
                </h3>
                <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                  Reported {formatDistanceToNow(selectedIssue.createdAt, { addSuffix: true })} by {selectedIssue.createdBy}
                </p>
              </div>

              {/* Status stepper */}
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-zinc-100 dark:border-zinc-900 my-1">
                {[
                  { step: "Reported", desc: "Logged", active: true },
                  { step: "In Progress", desc: "Dispatched", active: selectedIssue.status === "In Progress" || selectedIssue.status === "Resolved" },
                  { step: "Resolved", desc: "Completed", active: selectedIssue.status === "Resolved" }
                ].map((s) => (
                  <div key={s.step} className="flex flex-col items-center text-center">
                    <div className={`w-2.5 h-2.5 rounded-full mb-1 ${s.active ? "bg-emerald-500 ring-4 ring-emerald-500/20" : "bg-zinc-200 dark:bg-zinc-800"}`}></div>
                    <span className={`text-[10px] font-extrabold ${s.active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400"}`}>
                      {s.step}
                    </span>
                    <span className="text-[8px] text-zinc-400">{s.desc}</span>
                  </div>
                ))}
              </div>

              {/* Double Photo comparison (Before vs After) */}
              {selectedIssue.status === "Resolved" && selectedIssue.afterPhotoUrl ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-extrabold text-rose-500 uppercase">Before Repair</span>
                    <img 
                      src={selectedIssue.photoUrl} 
                      alt="Before" 
                      className="aspect-square w-full object-cover rounded-xl border border-zinc-200 dark:border-zinc-800" 
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-extrabold text-emerald-500 uppercase">Fixed state</span>
                    <img 
                      src={selectedIssue.afterPhotoUrl} 
                      alt="After" 
                      className="aspect-square w-full object-cover rounded-xl border border-emerald-500/30" 
                    />
                  </div>
                </div>
              ) : (
                <img 
                  src={selectedIssue.photoUrl} 
                  alt={selectedIssue.category} 
                  className="aspect-video w-full object-cover rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm" 
                />
              )}

              {/* Description */}
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl">
                <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-wider block mb-1">Reporter Log</span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {selectedIssue.description}
                </p>
              </div>

              {/* Action Verifications */}
              <div className="flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/50 dark:border-emerald-800/20 p-3 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {selectedIssue.verificationsCount || 0} Verifications
                  </span>
                  <span className="text-[9px] text-zinc-400">Help verify this report is still active</span>
                </div>
                <button
                  onClick={() => handleVerify(selectedIssue.id)}
                  disabled={selectedIssue.verifiedUsers?.includes(userId) || selectedIssue.status === "Resolved"}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {selectedIssue.verifiedUsers?.includes(userId) ? "Verified" : "Verify (+25 XP)"}
                </button>
              </div>

              {/* Comments Feed list */}
              <div className="flex flex-col gap-2 mt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Discussion Feed</h4>
                
                <div className="flex flex-col gap-2 max-h-44 overflow-y-auto">
                  {(selectedIssue.comments || []).length === 0 ? (
                    <p className="text-[10px] text-zinc-400 italic text-center py-2">No comments yet. Start coordinates discussion below.</p>
                  ) : (
                    selectedIssue.comments.map((comment, index) => (
                      <div key={index} className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/40 p-2.5 rounded-xl">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200">{comment.userName}</span>
                          <span className="text-[8px] text-zinc-400">
                            {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-normal">{comment.text}</p>
                      </div>
                    ))
                  )}
                  <div ref={commentEndRef}></div>
                </div>

                {/* Comment Form input */}
                {selectedIssue.status !== "Resolved" && (
                  <form onSubmit={handlePostComment} className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Discuss coordination/location details..."
                      className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-950 dark:text-zinc-50 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold px-4 rounded-xl text-xs transition-colors"
                    >
                      Post
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Center '+' Camera Trigger Button */}
      <button 
        onClick={onTriggerCamera}
        className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-20 w-14 h-14 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-emerald-600/20 hover:shadow-xl transition-all border-4 border-zinc-50 dark:border-[#09090b]"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Bottom Navigation Tab Bar */}
      <div className="h-16 bg-white dark:bg-[#0c0c0f] border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around px-2 z-10 safe-bottom">
        <button 
          onClick={() => setActiveTab("map")}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
            activeTab === "map" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[9px] font-bold">Map</span>
        </button>

        <button 
          onClick={() => setActiveTab("feed")}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
            activeTab === "feed" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <List className="w-5 h-5" />
          <span className="text-[9px] font-bold">Feed</span>
        </button>

        {/* Dummy spacer for central floating camera key */}
        <div className="w-10"></div>

        <button 
          onClick={() => setActiveTab("leaderboard")}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
            activeTab === "leaderboard" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[9px] font-bold">Leaderboard</span>
        </button>

        <button 
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
            activeTab === "profile" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[9px] font-bold">Profile</span>
        </button>
      </div>
    </div>
  );
}
