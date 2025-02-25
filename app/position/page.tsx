"use client";

import { TradingPositionsDashboard } from "@/components/trading/trading-positions-dashboard";

export default function PositionPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <TradingPositionsDashboard />
    </div>
  );
}