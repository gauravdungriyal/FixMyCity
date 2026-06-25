import React, { useState } from "react";
import ReactECharts from "echarts-for-react";
import { 
  ClipboardList, 
  BarChart3, 
  LogOut, 
  CheckCircle, 
  Play, 
  Camera, 
  X, 
  ChevronRight, 
  ThumbsUp, 
  Loader2, 
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { updateIssueStatus, uploadIssueImage } from "../services/firebase";
import { CIVIC_CATEGORIES } from "../services/gemini";

// Safe date formatting utility to prevent RangeError crashes
const safeFormatDistanceToNow = (dateVal) => {
  if (!dateVal) return "unknown time";
  try {
    let dateObj;
    if (typeof dateVal.toDate === "function") {
      dateObj = dateVal.toDate();
    } else if (dateVal instanceof Date) {
      dateObj = dateVal;
    } else if (typeof dateVal === "number") {
      dateObj = new Date(dateVal);
    } else if (typeof dateVal === "string") {
      if (/^\d+$/.test(dateVal)) {
        dateObj = new Date(parseInt(dateVal, 10));
      } else {
        dateObj = new Date(dateVal);
      }
    } else if (dateVal.seconds) {
      dateObj = new Date(dateVal.seconds * 1000);
    } else {
      dateObj = new Date(dateVal);
    }
    
    if (isNaN(dateObj.getTime())) {
      return "some time ago";
    }
    
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "some time ago";
  }
};

export default function AdminPortal({ 
  issues, 
  onLogOut,
  onTriggerCamera, // Camera module handle
  adminCapturedImage,
  onResetAdminCapture
}) {
  const [adminTab, setAdminTab] = useState("queue"); // queue, stats
  const [statusFilter, setStatusFilter] = useState("Active"); // Active, Reported, In Progress, Resolved
  const [selectedAdminIssue, setSelectedAdminIssue] = useState(null);
  const [showAdminDrawer, setShowAdminDrawer] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  // Filters issues based on tab status selection
  const filteredIssues = issues.filter(issue => {
    if (statusFilter === "Active") return issue.status === "Reported" || issue.status === "In Progress";
    return issue.status === statusFilter;
  });

  // Calculate high-level stats
  const totalCount = issues.length;
  const reportedCount = issues.filter(i => i.status === "Reported").length;
  const inProgressCount = issues.filter(i => i.status === "In Progress").length;
  const resolvedCount = issues.filter(i => i.status === "Resolved").length;

  // Setup ECharts Analytics configuration
  const getChartOption = () => {
    // Tally issues per category
    const categoryTallies = {};
    CIVIC_CATEGORIES.forEach(cat => {
      categoryTallies[cat] = 0;
    });
    
    issues.forEach(issue => {
      if (categoryTallies[issue.category] !== undefined) {
        categoryTallies[issue.category]++;
      } else {
        categoryTallies["Other Civic Issue"] = (categoryTallies["Other Civic Issue"] || 0) + 1;
      }
    });

    // Filter out categories with zero issues to save space on mobile
    const chartData = Object.keys(categoryTallies)
      .map(key => ({ name: key.replace(/\\s*\\(.*\\)/, ""), value: categoryTallies[key] }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)"
      },
      legend: {
        orient: "vertical",
        left: "left",
        textStyle: { color: "#71717a", fontSize: 9 },
        itemWidth: 10,
        itemHeight: 10
      },
      series: [
        {
          name: "Complaints Tally",
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: "#09090b",
            borderWidth: 2
          },
          label: {
            show: false
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: "bold"
            }
          },
          data: chartData.length > 0 ? chartData : [{ name: "No Active Tickets", value: 0 }]
        }
      ],
      color: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"]
    };
  };

  // Mark status as 'In Progress'
  const handleStartWork = async (issueId) => {
    try {
      await updateIssueStatus(issueId, "In Progress");
      // Update drawer state to reflect immediately
      setSelectedAdminIssue(prev => ({ ...prev, status: "In Progress" }));
    } catch (err) {
      console.error("Error setting ticket in progress:", err);
    }
  };

  // Submit resolution to Firestore (with live photo proof)
  const handleCompleteResolution = async (e) => {
    e.preventDefault();
    if (!adminCapturedImage) {
      setResolveError("Please capture an 'After' image to prove resolution.");
      return;
    }

    setIsResolving(true);
    setResolveError("");

    try {
      const fileName = `resolved_${selectedAdminIssue.id}_${Date.now()}.jpg`;
      const afterUrl = await uploadIssueImage(adminCapturedImage, fileName);
      
      await updateIssueStatus(selectedAdminIssue.id, "Resolved", afterUrl);

      onResetAdminCapture();
      setShowAdminDrawer(false);
      setSelectedAdminIssue(null);
    } catch (err) {
      console.error("Resolution submit error:", err);
      setResolveError("Failed to upload resolution proof.");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden relative">
      {/* Admin Header */}
      <div className="px-5 py-4 border-b border-zinc-800 bg-[#0c0c0f] z-10 shadow-md flex justify-between items-center safe-top-padding">
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse"></span>
            Field Ops Portal
          </h1>
          <p className="text-[10px] text-zinc-400 font-medium tracking-wide uppercase">Municipal Dashboard</p>
        </div>
        <button
          onClick={onLogOut}
          className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-rose-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Exit
        </button>
      </div>

      {/* Main stats layout */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* Tab 1: Issues Queue List */}
        {adminTab === "queue" && (
          <div className="w-full h-full flex flex-col">
            {/* Horizontal KPI bar cards */}
            <div className="grid grid-cols-3 gap-2 p-4 bg-zinc-900/50 border-b border-zinc-800">
              <div className="bg-[#0c0c0f] border border-zinc-800 p-2.5 rounded-2xl text-center">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Reported</span>
                <p className="text-base font-black text-rose-500 mt-0.5">{reportedCount}</p>
              </div>
              <div className="bg-[#0c0c0f] border border-zinc-800 p-2.5 rounded-2xl text-center">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Active Ops</span>
                <p className="text-base font-black text-yellow-500 mt-0.5">{inProgressCount}</p>
              </div>
              <div className="bg-[#0c0c0f] border border-zinc-800 p-2.5 rounded-2xl text-center">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Resolved</span>
                <p className="text-base font-black text-emerald-500 mt-0.5">{resolvedCount}</p>
              </div>
            </div>

            {/* Quick status filters */}
            <div className="flex gap-1.5 p-3.5 overflow-x-auto shrink-0 bg-zinc-950">
              {["Active", "Reported", "In Progress", "Resolved"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-all shrink-0 ${
                    statusFilter === filter
                      ? "bg-zinc-100 text-zinc-950 border-zinc-100"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {filter} ({filter === "Active" ? reportedCount + inProgressCount : filter === "Reported" ? reportedCount : filter === "In Progress" ? inProgressCount : resolvedCount})
                </button>
              ))}
            </div>

            {/* List queue */}
            <div className="flex-1 overflow-y-auto px-4 pb-16 flex flex-col gap-2.5">
              {filteredIssues.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-50">
                  <ClipboardList className="w-10 h-10 text-zinc-600 mb-2" />
                  <span className="text-xs text-zinc-500">No matching tickets in this status filter.</span>
                </div>
              ) : (
                filteredIssues.map((issue) => (
                  <div
                    key={issue.id}
                    onClick={() => {
                      setSelectedAdminIssue(issue);
                      setShowAdminDrawer(true);
                      onResetAdminCapture(); // Clean any cached camera proofs
                    }}
                    className="bg-[#0c0c0f] border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden p-3 flex gap-3 cursor-pointer transition-all active:scale-98 shadow-sm"
                  >
                    <img 
                      src={issue.photoUrl} 
                      alt={issue.category} 
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-zinc-900" 
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            issue.status === "Resolved" 
                              ? "bg-emerald-950/30 text-emerald-400 border border-emerald-800/40"
                              : issue.status === "In Progress"
                              ? "bg-amber-950/30 text-amber-400 border border-amber-800/40"
                              : "bg-rose-950/30 text-rose-400 border border-rose-800/40"
                          }`}>
                            {issue.status}
                          </span>
                          <span className="text-[9px] text-zinc-500">
                            {safeFormatDistanceToNow(issue.createdAt)}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold truncate text-white">{issue.category}</h4>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{issue.description}</p>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-1 font-bold">
                        <span className="flex items-center gap-1.5">
                          <ThumbsUp className="w-3 h-3 text-emerald-500" />
                          {issue.verificationsCount || 0} Upvotes
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-md font-bold text-[8px] ${
                          issue.urgency === "High" ? "bg-rose-950 text-rose-400" : issue.urgency === "Medium" ? "bg-amber-950 text-amber-400" : "bg-emerald-950 text-emerald-400"
                        }`}>
                          {issue.urgency} Urgency
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Stats & Analytical Charts */}
        {adminTab === "stats" && (
          <div className="w-full h-full overflow-y-auto p-4 flex flex-col gap-4">
            <div className="bg-[#0c0c0f] border border-zinc-800 rounded-2xl p-4 flex flex-col">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 mb-4">Issues Breakdown</h3>
              <div className="h-64 w-full">
                <ReactECharts 
                  option={getChartOption()} 
                  style={{ height: "100%", width: "100%" }}
                  theme="dark"
                />
              </div>
            </div>

            {/* Performance Metric Summaries */}
            <div className="bg-[#0c0c0f] border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 border-b border-zinc-900 pb-2">Response Quality</h3>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Gross Ticket count:</span>
                <span className="font-mono font-bold text-white">{totalCount}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Resolution Completion Rate:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {totalCount > 0 ? ((resolvedCount / totalCount) * 100).toFixed(0) : "0"}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Average Triage Time:</span>
                <span className="font-mono font-bold text-white">&lt; 3 mins (Real-time AI)</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Admin detail/action Drawer overlay */}
      {showAdminDrawer && selectedAdminIssue && (
        <div className="absolute inset-0 bg-black/85 z-30 flex flex-col justify-end">
          <div className="w-full h-[85%] bg-zinc-900 rounded-t-3xl border-t border-zinc-800 overflow-hidden flex flex-col animate-slide-up relative safe-bottom">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#0c0c0f]">
              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                selectedAdminIssue.status === "Resolved" 
                  ? "bg-emerald-950/30 text-emerald-400 border border-emerald-800/40"
                  : selectedAdminIssue.status === "In Progress"
                  ? "bg-amber-950/30 text-amber-400 border border-amber-800/40"
                  : "bg-rose-950/30 text-rose-400 border border-rose-800/40"
              }`}>
                {selectedAdminIssue.status}
              </span>
              <button 
                onClick={() => { setShowAdminDrawer(false); setSelectedAdminIssue(null); onResetAdminCapture(); }}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrolling info */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs text-zinc-300">
              
              {/* Category title */}
              <div>
                <h3 className="text-sm font-extrabold text-white leading-tight">{selectedAdminIssue.category}</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  ID: <span className="font-mono">{selectedAdminIssue.id}</span>
                </p>
              </div>

              {/* Photo comparisons or details */}
              {selectedAdminIssue.status === "Resolved" && selectedAdminIssue.afterPhotoUrl ? (
                <div className="grid grid-cols-2 gap-2.5 my-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-extrabold text-rose-500 uppercase tracking-wider">Before</span>
                    <img src={selectedAdminIssue.photoUrl} alt="Before" className="aspect-square object-cover rounded-xl border border-zinc-800" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] font-extrabold text-emerald-500 uppercase tracking-wider">Resolved</span>
                    <img src={selectedAdminIssue.afterPhotoUrl} alt="After" className="aspect-square object-cover rounded-xl border border-zinc-800" />
                  </div>
                </div>
              ) : (
                <img 
                  src={selectedAdminIssue.photoUrl} 
                  alt="Issue" 
                  className="w-full aspect-video object-cover rounded-xl border border-zinc-800" 
                />
              )}

              {/* Description */}
              <div className="bg-[#0c0c0f] border border-zinc-800 p-3 rounded-xl">
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Citizen Logs</span>
                <p className="leading-relaxed text-zinc-300">{selectedAdminIssue.description}</p>
              </div>

              {/* Urgency and Location indicators */}
              <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                <div className="bg-[#0c0c0f] border border-zinc-800 p-2 rounded-xl">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">Urgency</span>
                  <span className={`font-bold ${
                    selectedAdminIssue.urgency === "High" ? "text-rose-400" : selectedAdminIssue.urgency === "Medium" ? "text-amber-400" : "text-emerald-400"
                  }`}>{selectedAdminIssue.urgency}</span>
                </div>
                <div className="bg-[#0c0c0f] border border-zinc-800 p-2 rounded-xl">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">Upvotes</span>
                  <span className="font-mono font-bold text-white">{selectedAdminIssue.verificationsCount || 0}</span>
                </div>
              </div>

              {/* Operations Workflow Actions */}
              {selectedAdminIssue.status === "Reported" && (
                <button
                  onClick={() => handleStartWork(selectedAdminIssue.id)}
                  className="mt-4 w-full bg-yellow-500 hover:bg-yellow-600 text-zinc-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow"
                >
                  <Play className="w-4 h-4 fill-zinc-950" />
                  Claim Ticket (Set In Progress)
                </button>
              )}

              {selectedAdminIssue.status === "In Progress" && (
                <div className="flex flex-col gap-4 border-t border-zinc-800 pt-4 mt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Resolution Verification (On-Site)</h4>
                  
                  {resolveError && (
                    <div className="p-3 bg-rose-950/20 border border-rose-800/30 text-rose-400 rounded-xl text-[10px]">
                      {resolveError}
                    </div>
                  )}

                  {/* Camera action proofs */}
                  {adminCapturedImage ? (
                    <div className="flex flex-col gap-2">
                      <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-emerald-500/30">
                        <img src={adminCapturedImage} alt="Fixed Proof" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={onResetAdminCapture}
                          className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <button
                        onClick={handleCompleteResolution}
                        disabled={isResolving}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow flex items-center justify-center gap-2"
                      >
                        {isResolving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Completing ticket...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Submit Repair Proof (Resolve)
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onTriggerCamera}
                      className="w-full border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-[#0c0c0f] hover:bg-zinc-900 py-6 px-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-zinc-400 font-semibold transition-all"
                    >
                      <Camera className="w-6 h-6 text-zinc-500" />
                      Take 'After' Fix Photo
                      <span className="text-[9px] font-normal text-zinc-500 italic">Live camera capture required</span>
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Admin Bottom Navigation Menu */}
      <div className="h-16 bg-[#0c0c0f] border-t border-zinc-800 flex items-center justify-around z-10 safe-bottom">
        <button 
          onClick={() => setAdminTab("queue")}
          className={`flex flex-col items-center gap-1 py-1 px-6 rounded-xl transition-all ${
            adminTab === "queue" ? "text-emerald-500" : "text-zinc-500 hover:text-zinc-200"
          }`}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="text-[9px] font-bold">Work Queue</span>
        </button>

        <button 
          onClick={() => setAdminTab("stats")}
          className={`flex flex-col items-center gap-1 py-1 px-6 rounded-xl transition-all ${
            adminTab === "stats" ? "text-emerald-500" : "text-zinc-500 hover:text-zinc-200"
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[9px] font-bold">Analytics</span>
        </button>
      </div>
    </div>
  );
}
