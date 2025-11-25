"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Gift, 
  ExternalLink, 
  Copy, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ShoppingBag,
  Loader2,
  Calendar,
  Coins
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { RewardRedemption } from "@/types";

type RedemptionStatus = "active" | "used" | "expired";

export default function MyRewardsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RedemptionStatus>("active");

  useEffect(() => {
    if (user) {
      fetchRedemptions();
    }
  }, [user]);

  const fetchRedemptions = async () => {
    try {
      const response = await fetch(`/api/wellness/redemptions?userId=${user?.uid}`);
      if (response.ok) {
        const data = await response.json();
        setRedemptions(data.redemptions || []);
      }
    } catch (error) {
      console.error("Error fetching redemptions:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code Copied!",
      description: "Redemption code copied to clipboard",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "used":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Used
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return null;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      pharmacy: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      fitness: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
      nutrition: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
      services: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      premium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    };
    return colors[category?.toLowerCase()] || "bg-gray-100 text-gray-700";
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp?.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isExpired = (expiresAt: any) => {
    if (!expiresAt) return false;
    const expiry = expiresAt?.toDate?.() || new Date(expiresAt);
    return expiry < new Date();
  };

  const getDaysRemaining = (expiresAt: any) => {
    if (!expiresAt) return null;
    const expiry = expiresAt?.toDate?.() || new Date(expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const filteredRedemptions = redemptions.filter((redemption) => {
    // Auto-update status based on expiry
    if (isExpired(redemption.expiresAt) && redemption.status === "active") {
      return activeTab === "expired";
    }
    return redemption.status === activeTab;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-teal-50/30 to-cyan-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Gift className="h-10 w-10 text-teal-600" />
              My Rewards
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              View and manage your redeemed wellness benefits
            </p>
          </div>
          <Button
            onClick={() => router.push("/patient/wellness/marketplace")}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            Browse Marketplace
          </Button>
        </div>

        {/* Status Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RedemptionStatus)}>
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="active">
              Active ({redemptions.filter(r => r.status === "active" && !isExpired(r.expiresAt)).length})
            </TabsTrigger>
            <TabsTrigger value="used">
              Used ({redemptions.filter(r => r.status === "used").length})
            </TabsTrigger>
            <TabsTrigger value="expired">
              Expired ({redemptions.filter(r => r.status === "expired" || isExpired(r.expiresAt)).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredRedemptions.length === 0 ? (
              <Card className="p-12 text-center">
                <Gift className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold mb-2">
                  {activeTab === "active" && "No Active Rewards"}
                  {activeTab === "used" && "No Used Rewards"}
                  {activeTab === "expired" && "No Expired Rewards"}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {activeTab === "active" && "Redeem rewards from the marketplace to see them here."}
                  {activeTab === "used" && "Rewards you've used will appear here."}
                  {activeTab === "expired" && "Expired rewards will be shown here."}
                </p>
                <Button
                  onClick={() => router.push("/patient/wellness/marketplace")}
                  className="bg-gradient-to-r from-teal-600 to-cyan-600"
                >
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Go to Marketplace
                </Button>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {filteredRedemptions.map((redemption) => {
                  const daysRemaining = getDaysRemaining(redemption.expiresAt);
                  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;

                  return (
                    <Card
                      key={redemption.id}
                      className={`relative overflow-hidden ${
                        isExpiringSoon && redemption.status === "active"
                          ? "border-2 border-orange-500"
                          : ""
                      }`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{redemption.rewardTitle}</CardTitle>
                          {getStatusBadge(
                            isExpired(redemption.expiresAt) ? "expired" : redemption.status
                          )}
                        </div>
                        <div className="flex gap-2 mt-2">
                          {redemption.rewardCategory && (
                            <Badge className={getCategoryColor(redemption.rewardCategory)}>
                              {redemption.rewardCategory}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            <Coins className="h-3 w-3 mr-1" />
                            {redemption.costTokens} WC
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Redemption Code */}
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Redemption Code
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-xl font-mono font-bold text-teal-600 dark:text-teal-500">
                              {redemption.code}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(redemption.code)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Redeemed
                            </p>
                            <p className="font-medium">{formatDate(redemption.redeemedAt)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {redemption.status === "active" ? "Expires" : "Expired"}
                            </p>
                            <p className={`font-medium ${isExpiringSoon ? "text-orange-600" : ""}`}>
                              {formatDate(redemption.expiresAt)}
                              {daysRemaining !== null && redemption.status === "active" && (
                                <span className="text-xs ml-1">
                                  ({daysRemaining} {daysRemaining === 1 ? "day" : "days"} left)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Expiring Soon Warning */}
                        {isExpiringSoon && redemption.status === "active" && (
                          <div className="flex items-start gap-2 text-xs bg-orange-50 dark:bg-orange-950/30 p-3 rounded border border-orange-200 dark:border-orange-900">
                            <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-orange-600" />
                            <p className="text-orange-900 dark:text-orange-100">
                              <strong>Expiring Soon!</strong> Use your code within {daysRemaining}{" "}
                              {daysRemaining === 1 ? "day" : "days"}.
                            </p>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter>
                        {redemption.externalUrl && redemption.status === "active" && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              const url = new URL(redemption.externalUrl!);
                              url.searchParams.set("coupon", redemption.code);
                              window.open(url.toString(), "_blank");
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Use on Partner Website
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
