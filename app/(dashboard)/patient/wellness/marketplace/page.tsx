"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coins, ExternalLink, ShoppingBag, AlertCircle, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { WellnessReward } from "@/types";

type Category = "All" | "Pharmacy" | "Fitness" | "Nutrition" | "Services" | "Premium";

export default function MarketplacePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [rewards, setRewards] = useState<WellnessReward[]>([]);
  const [filteredRewards, setFilteredRewards] = useState<WellnessReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWC, setCurrentWC] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [selectedReward, setSelectedReward] = useState<WellnessReward | null>(null);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRewards();
      fetchUserBalance();
    }
  }, [user]);

  useEffect(() => {
    filterRewards();
  }, [selectedCategory, rewards]);

  const fetchRewards = async () => {
    try {
      const response = await fetch("/api/wellness/rewards");
      if (response.ok) {
        const data = await response.json();
        setRewards(data.rewards || []);
      }
    } catch (error) {
      console.error("Error fetching rewards:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBalance = async () => {
    try {
      const response = await fetch(`/api/wellness/convert?userId=${user?.uid}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentWC(data.currentWC || 0);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  const filterRewards = () => {
    if (selectedCategory === "All") {
      setFilteredRewards(rewards);
    } else {
      setFilteredRewards(
        rewards.filter((reward) => reward.category.toLowerCase() === selectedCategory.toLowerCase())
      );
    }
  };

  const handleRedeemClick = (reward: WellnessReward) => {
    setSelectedReward(reward);
    setRedeemDialogOpen(true);
  };

  const handleRedeem = async () => {
    if (!selectedReward || !user) return;

    setRedeeming(true);
    try {
      const response = await fetch("/api/wellness/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          rewardId: selectedReward.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "✅ Reward Redeemed!",
          description: `Your redemption code: ${data.code}`,
        });

        setRedeemDialogOpen(false);
        fetchUserBalance();

        // Redirect to external URL if provided
        if (data.redirectUrl) {
          setTimeout(() => {
            window.open(data.redirectUrl, "_blank");
          }, 1500);
        }

        // Navigate to My Rewards page
        setTimeout(() => {
          router.push("/patient/wellness/rewards");
        }, 2000);
      } else {
        toast({
          title: "Redemption Failed",
          description: data.error || "Something went wrong",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Redemption error:", error);
      toast({
        title: "Error",
        description: "Failed to redeem reward",
        variant: "destructive",
      });
    } finally {
      setRedeeming(false);
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
    return colors[category.toLowerCase()] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-teal-50/30 to-cyan-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ShoppingBag className="h-10 w-10 text-teal-600" />
              Wellness Marketplace
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Redeem your Wellness Coins for exclusive health benefits
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 dark:text-gray-400">Your Balance</p>
            <p className="text-3xl font-bold text-teal-600 dark:text-teal-500 flex items-center gap-2">
              <Coins className="h-8 w-8" />
              {currentWC} WC
            </p>
          </div>
        </div>

        {/* Category Filters */}
        <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as Category)}>
          <TabsList className="grid grid-cols-6 w-full max-w-3xl">
            <TabsTrigger value="All">All</TabsTrigger>
            <TabsTrigger value="Pharmacy">Pharmacy</TabsTrigger>
            <TabsTrigger value="Fitness">Fitness</TabsTrigger>
            <TabsTrigger value="Nutrition">Nutrition</TabsTrigger>
            <TabsTrigger value="Services">Services</TabsTrigger>
            <TabsTrigger value="Premium">Premium</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Rewards Grid */}
        {filteredRewards.length === 0 ? (
          <Card className="p-12 text-center">
            <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold mb-2">No rewards available</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {selectedCategory === "All" 
                ? "Check back soon for new rewards!"
                : `No ${selectedCategory.toLowerCase()} rewards available right now.`
              }
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRewards.map((reward) => {
              const canAfford = currentWC >= reward.costTokens;
              
              return (
                <Card
                  key={reward.id}
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                    !canAfford ? "opacity-60" : "hover:-translate-y-1"
                  }`}
                >
                  {reward.imageUrl && (
                    <div className="w-full h-48 bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 flex items-center justify-center">
                      <img
                        src={reward.imageUrl}
                        alt={reward.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{reward.title}</CardTitle>
                      <Badge className={getCategoryColor(reward.category)}>
                        {reward.category}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {reward.description || "Exclusive wellness benefit"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-teal-600" />
                        <span className="text-2xl font-bold text-teal-600 dark:text-teal-500">
                          {reward.costTokens}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">WC</span>
                      </div>
                      {reward.externalUrl && (
                        <Badge variant="outline" className="text-xs">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Partner
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => handleRedeemClick(reward)}
                      disabled={!canAfford || !reward.active}
                      className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
                    >
                      {!canAfford ? (
                        <>
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Insufficient Balance
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Redeem Now
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Redemption Confirmation Dialog */}
        <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Confirm Redemption</DialogTitle>
              <DialogDescription>
                Review the details before redeeming this reward
              </DialogDescription>
            </DialogHeader>

            {selectedReward && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{selectedReward.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedReward.description || "Exclusive wellness benefit for your health journey"}
                  </p>
                </div>

                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Current Balance:</span>
                    <span className="font-semibold">{currentWC} WC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Cost:</span>
                    <span className="font-semibold text-red-600">-{selectedReward.costTokens} WC</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">Balance After:</span>
                    <span className="font-bold text-teal-600">
                      {currentWC - selectedReward.costTokens} WC
                    </span>
                  </div>
                </div>

                {selectedReward.externalUrl && (
                  <div className="flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/30 p-3 rounded border border-blue-200 dark:border-blue-900">
                    <ExternalLink className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
                    <p className="text-blue-900 dark:text-blue-100">
                      <strong>Partner Benefit:</strong> After redemption, you'll be redirected to our partner's website with your unique coupon code.
                    </p>
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <p>• Redemption is final and cannot be reversed</p>
                  <p>• Coupon codes are valid for 90 days from redemption date</p>
                  <p>• Check your "My Rewards" page for redemption details</p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRedeemDialogOpen(false)} disabled={redeeming}>
                Cancel
              </Button>
              <Button
                onClick={handleRedeem}
                disabled={redeeming}
                className="bg-gradient-to-r from-teal-600 to-cyan-600"
              >
                {redeeming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redeeming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm Redemption
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
