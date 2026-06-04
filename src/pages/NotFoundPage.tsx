import React from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="fixed inset-0 z-[100] bg-[#0B1120] flex flex-col items-center justify-center p-4 text-center overflow-auto">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,170,0.03)_1px,transparent_1px),linear-gradient(to_right,rgba(0,212,170,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
      
      <div className="relative flex flex-col items-center">
        <div className="w-20 h-20 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center justify-center mb-6 shadow-2xl">
          <Search size={40} className="text-blue-500" />
        </div>
        <h3 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>404 - Not Found</h3>
        <p className="text-[#94A3B8] max-w-md text-lg leading-relaxed mb-8">
          The page you are looking for doesn't exist or has been moved. 
          <br />
          Please check the URL or return to the dashboard.
        </p>
        <Link 
          to="/"
          className="px-8 py-3 bg-[#00D4AA] text-[#0F1729] font-bold rounded-xl hover:bg-[#00D4AA]/90 transition-all shadow-lg hover:shadow-[#00D4AA]/20 hover:-translate-y-0.5 active:translate-y-0"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
