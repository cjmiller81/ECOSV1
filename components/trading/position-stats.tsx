import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PositionStatsProps {
  data: {
    stocks: number;
    options: number;
    bonds: number;
    strategies: Record<string, number>;
    expirations: {
      next7Days: number;
      next8to30Days: number;
      next31to90Days: number;
      over90Days: number;
    };
  };
}

export function PositionStats({ data }: PositionStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3 mb-4">
      <Card className="bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Position Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Total Stock/ETF Positions:</span>
              <span className="font-medium">{data.stocks}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Option Positions:</span>
              <span className="font-medium">{data.options}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Bond/CD Positions:</span>
              <span className="font-medium">{data.bonds}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-green-50/50 dark:bg-green-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Option Strategies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Object.entries(data.strategies).map(([strategy, count]) => (
              <div key={strategy} className="flex justify-between">
                <span>{strategy}:</span>
                <span className="font-medium">{count} positions</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-yellow-50/50 dark:bg-yellow-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Upcoming Expirations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Next 7 Days:</span>
              <span className="font-medium">{data.expirations.next7Days} options</span>
            </div>
            <div className="flex justify-between">
              <span>8-30 Days:</span>
              <span className="font-medium">{data.expirations.next8to30Days} options</span>
            </div>
            <div className="flex justify-between">
              <span>31-90 Days:</span>
              <span className="font-medium">{data.expirations.next31to90Days} options</span>
            </div>
            <div className="flex justify-between">
              <span>&gt;90 Days:</span>
              <span className="font-medium">{data.expirations.over90Days} options</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}