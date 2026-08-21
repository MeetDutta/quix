"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PortalRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4EF] dark:bg-[#0F0E0D]">
      <div className="flex items-center gap-3 bg-white dark:bg-[#171615] px-5 py-3.5 rounded-xl border border-[#E5E0D8] dark:border-[#292524] shadow-xs">
        <div className="w-4 h-4 rounded-full border-2 border-[#C84B18] dark:border-[#EA580C] border-t-transparent animate-spin" />
        <span className="font-medium text-xs text-[#242321] dark:text-[#F5F5F4]">Loading Workspace Mode...</span>
      </div>
    </div>
  );
}
