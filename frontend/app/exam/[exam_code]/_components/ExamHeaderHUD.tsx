"use client";

import { Timer, Calculator, Maximize2, Minimize2, Cloud, CloudOff, ShieldAlert, Sparkles, LogOut, LayoutGrid } from "lucide-react";

interface ExamHeaderHUDProps {
  examName: string;
  candidateName: string;
  timeRemainingSeconds: number;
  syncStatus: "Synced" | "Saving..." | "Unsynced (Local)" | string;
  isCalculatorOpen: boolean;
  onToggleCalculator: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isSimulation?: boolean;
  onExitSimulation?: () => void;
  tabSwitchCount?: number;
  proctorEventCount?: number;
  onTogglePalette?: () => void;
  answeredCount?: number;
  totalQuestions?: number;
}

export default function ExamHeaderHUD({
  examName,
  candidateName,
  timeRemainingSeconds,
  syncStatus,
  isCalculatorOpen,
  onToggleCalculator,
  isFullscreen,
  onToggleFullscreen,
  isSimulation = false,
  onExitSimulation,
  tabSwitchCount = 0,
  proctorEventCount = 0,
}: ExamHeaderHUDProps) {
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isLowTime = timeRemainingSeconds <= 300; // <= 5 min
  const isCriticalTime = timeRemainingSeconds <= 120; // <= 2 min

  return (
    <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 dark:bg-[#171615]/95 backdrop-blur-md border-b border-[#E5E0D8] dark:border-[#292524] shadow-xs pt-safe">
      {/* Teacher Simulation Top Banner */}
      {isSimulation && (
        <div className="bg-amber-500/10 dark:bg-amber-500/20 border-b border-amber-500/30 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-300">
          <div className="flex items-center gap-1.5 sm:gap-2 font-semibold truncate">
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">Teacher Sandbox Simulation Mode</span>
          </div>
          {onExitSimulation && (
            <button
              onClick={onExitSimulation}
              className="px-2 sm:px-2.5 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition-all shrink-0 ml-2 cursor-pointer"
            >
              <LogOut className="h-3 w-3" />
              <span>Exit</span>
            </button>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Exam Info & Candidate */}
        <div className="min-w-0 flex items-center gap-2 sm:gap-3">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-[#C84B18]/10 text-[#C84B18] dark:bg-[#EA580C]/15 dark:text-[#EA580C] flex items-center justify-center font-bold font-serif text-sm sm:text-base shrink-0">
            EQ
          </div>
          <div className="truncate">
            <h1 className="text-xs sm:text-base font-bold text-[#242321] dark:text-[#F5F5F4] truncate">
              {examName}
            </h1>
            <p className="text-[10px] sm:text-[11px] text-[#716D67] dark:text-[#A8A29E] truncate">
              <span className="hidden sm:inline">Candidate: </span>
              <span className="font-semibold text-[#242321] dark:text-[#F5F5F4]">{candidateName}</span>
            </p>
          </div>
        </div>

        {/* Center: High Visibility Timer */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border flex items-center gap-1.5 sm:gap-2 font-mono font-bold text-xs sm:text-base transition-all ${
              isCriticalTime
                ? "bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400 animate-pulse shadow-rose-500/20 shadow-md"
                : isLowTime
                ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400 shadow-xs"
                : "bg-[#F7F4EF] dark:bg-[#141312] border-[#E5E0D8] dark:border-[#292524] text-[#242321] dark:text-[#F5F5F4]"
            }`}
          >
            <Timer className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isCriticalTime ? "text-rose-600 animate-spin" : isLowTime ? "text-amber-600" : "text-[#C84B18]"}`} />
            <span>{formatTime(timeRemainingSeconds)}</span>
          </div>
        </div>

        {/* Right: Tools & Status Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Cloud Sync Status */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F4EF] dark:bg-[#141312] border border-[#E5E0D8] dark:border-[#292524] text-[11px] text-[#716D67] dark:text-[#A8A29E]">
            {syncStatus === "Synced" ? (
              <>
                <Cloud className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Synced</span>
              </>
            ) : syncStatus === "Saving..." ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full border-2 border-[#C84B18] border-t-transparent animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CloudOff className="h-3.5 w-3.5 text-amber-600" />
                <span className="font-medium text-amber-600">Local Buffer</span>
              </>
            )}
          </div>

          {/* Proctoring Warning Badge */}
          {tabSwitchCount > 0 && (
            <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] sm:text-[11px] font-bold border border-rose-300 dark:border-rose-800" title={`${tabSwitchCount}/3 tab switches recorded`}>
              <ShieldAlert className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-600" />
              <span>{tabSwitchCount}/3</span>
            </div>
          )}

          {/* Mobile Palette Trigger Button */}
          {onTogglePalette && (
            <button
              type="button"
              onClick={onTogglePalette}
              className="lg:hidden p-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#171615] text-[#716D67] hover:text-[#C84B18] dark:hover:text-white transition-all relative cursor-pointer"
              title="Open Question Palette"
              aria-label="Open Question Palette"
            >
              <LayoutGrid className="h-4 w-4" />
              {totalQuestions !== undefined && answeredCount !== undefined && (
                <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-[#C84B18] text-white text-[9px] font-bold flex items-center justify-center">
                  {answeredCount}
                </span>
              )}
            </button>
          )}

          {/* Calculator Toggle */}
          <button
            type="button"
            onClick={onToggleCalculator}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isCalculatorOpen
                ? "bg-[#C84B18] text-white border-[#C84B18]"
                : "border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#171615] text-[#716D67] hover:text-[#242321] dark:hover:text-white"
            }`}
            title="Toggle Scientific Calculator"
          >
            <Calculator className="h-4 w-4" />
            <span className="hidden md:inline">Calculator</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-2 rounded-xl border border-[#E5E0D8] dark:border-[#292524] bg-white dark:bg-[#171615] text-[#716D67] hover:text-[#242321] dark:hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen Mode"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
