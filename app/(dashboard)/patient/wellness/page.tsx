"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { FirestoreService } from "@/lib/services/firestore.service";
import { GamificationProgress } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Coins, TrendingUp, Sparkles, ArrowRight, History, Info, Zap, Filter, Target } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ConversionInfo {
  currentHP: number;
  currentWC: number;
  hpToWcRatio: number;
  dailyLimit: number;
  hpConvertedToday: number;
  dailyLimitRemaining: number;
  canConvert: boolean;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  source: string;
  hpUsed?: number;
  tokens: number;
  timestamp: any;
  description?: string;
}

export default function WellnessWalletPage() {
  const { user } = useAuthStore();
  const [gamificationProgress, setGamificationProgress] = useState<GamificationProgress | null>(null);
  const [conversionInfo, setConversionInfo] = useState<ConversionInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hpToConvert, setHpToConvert] = useState("");
  const [transactionFilter, setTransactionFilter] = useState<string>("all");

  // Subscribe to real-time gamification progress
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = FirestoreService.subscribeToGamificationProgress(
      user.uid,
      (progress) => {
        setGamificationProgress(progress);
        // Update conversion info with real-time HP
        if (progress) {
          setConversionInfo((prev) => prev ? {
            ...prev,
            currentHP: progress.totalPoints || 0,
          } : null);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchConversionInfo();
      fetchTransactions();
    }
  }, [user]);

  const fetchConversionInfo = async () => {
    try {
      const response = await fetch(`/api/wellness/convert?userId=${user?.uid}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Conversion info received:', data);
        setConversionInfo(data);
      }
    } catch (error) {
      console.error("Error fetching conversion info:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`/api/wellness/transactions?userId=${user?.uid}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const handleConvert = async () => {
    const amount = parseInt(hpToConvert);
    
    console.log('Convert button clicked:', { amount, userId: user?.uid, conversionInfo });
    
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid HP amount",
        variant: "destructive",
      });
      return;
    }

    if (amount % (conversionInfo?.hpToWcRatio || 50) !== 0) {
      toast({
        title: "Invalid Amount",
        description: `HP amount must be a multiple of ${conversionInfo?.hpToWcRatio || 50}`,
        variant: "destructive",
      });
      return;
    }

    setConverting(true);
    try {
      console.log('Sending conversion request...');
      const response = await fetch("/api/wellness/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.uid, hpAmount: amount }),
      });

      const data = await response.json();
      console.log('Conversion response:', { status: response.status, data });

      if (response.ok) {
        toast({
          title: "✅ Conversion Successful!",
          description: `Converted ${data.hpDeducted} HP to ${data.wcCredited} Wellness Coins`,
        });
        setDialogOpen(false);
        setHpToConvert("");
        fetchConversionInfo();
        fetchTransactions();
      } else {
        toast({
          title: "Conversion Failed",
          description: data.error || "Something went wrong",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Conversion error:", error);
      toast({
        title: "Error",
        description: "Failed to convert HP to Wellness Coins",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const calculateWC = (hp: string) => {
    const amount = parseInt(hp);
    if (!amount || !conversionInfo) return 0;
    return amount / conversionInfo.hpToWcRatio;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
            💎 Wellness Wallet
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Convert Health Points to Wellness Coins and unlock premium rewards
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* HP Balance */}
          <Card className="relative overflow-hidden border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-300/20 rounded-full -mr-16 -mt-16"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
                <Zap className="h-6 w-6" />
                Health Points (HP)
              </CardTitle>
              <CardDescription>Earn by completing health tasks</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-5xl font-bold text-yellow-600 dark:text-yellow-500">
                {gamificationProgress?.totalPoints?.toLocaleString() || conversionInfo?.currentHP?.toLocaleString() || 0}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                1 WC = {conversionInfo?.hpToWcRatio} HP
              </p>
            </CardContent>
          </Card>

          {/* WC Balance */}
          <Card className="relative overflow-hidden border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-300/20 rounded-full -mr-16 -mt-16"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-500">
                <Coins className="h-6 w-6" />
                Wellness Coins (WC)
              </CardTitle>
              <CardDescription>Premium currency for marketplace</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-5xl font-bold text-teal-600 dark:text-teal-500">
                {conversionInfo?.currentWC?.toLocaleString() || 0}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Redeem for exclusive rewards
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Section */}
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Convert HP to Wellness Coins
            </CardTitle>
            <CardDescription>
              Daily limit: {conversionInfo?.dailyLimitRemaining || 0} HP remaining today
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Converted Today</p>
                <p className="text-2xl font-bold">{conversionInfo?.hpConvertedToday || 0} HP</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Daily Limit</p>
                <p className="text-2xl font-bold">{conversionInfo?.dailyLimit || 0} HP</p>
              </div>
            </div>

            <Button 
              className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 h-12 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!conversionInfo?.canConvert}
              onClick={() => {
                console.log('Convert Now button clicked!');
                console.log('Can convert:', conversionInfo?.canConvert);
                console.log('Current HP:', conversionInfo?.currentHP);
                console.log('Full conversion info:', conversionInfo);
                
                if (conversionInfo?.canConvert) {
                  setDialogOpen(true);
                } else {
                  if ((conversionInfo?.currentHP || 0) < (conversionInfo?.hpToWcRatio || 50)) {
                    toast({
                      title: "Not Enough HP",
                      description: `You need at least ${conversionInfo?.hpToWcRatio || 50} HP to convert`,
                      variant: "destructive",
                    });
                  } else if ((conversionInfo?.dailyLimitRemaining || 0) <= 0) {
                    toast({
                      title: "Daily Limit Reached",
                      description: "You've reached your daily conversion limit. Try again tomorrow!",
                      variant: "destructive",
                    });
                  }
                }
              }}
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Convert Now
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>💎 Convert HP to Wellness Coins</DialogTitle>
                  <DialogDescription>
                    Enter the amount of Health Points you want to convert
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="hpAmount">Health Points (HP)</Label>
                    <Input
                      id="hpAmount"
                      type="number"
                      placeholder={`Enter HP (multiples of ${conversionInfo?.hpToWcRatio})`}
                      value={hpToConvert}
                      onChange={(e) => setHpToConvert(e.target.value)}
                      min={conversionInfo?.hpToWcRatio}
                      step={conversionInfo?.hpToWcRatio}
                    />
                  </div>
                  {hpToConvert && (
                    <div className="p-4 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200">
                      <p className="text-sm text-gray-600 dark:text-gray-400">You will receive:</p>
                      <p className="text-3xl font-bold text-teal-600 dark:text-teal-500">
                        {calculateWC(hpToConvert)} WC
                      </p>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>
                      Conversion rate: 1 WC = {conversionInfo?.hpToWcRatio} HP. Daily limit: {conversionInfo?.dailyLimit} HP. No reverse conversion allowed.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleConvert} 
                    disabled={converting || !hpToConvert}
                    className="bg-gradient-to-r from-teal-600 to-cyan-600"
                  >
                    {converting ? "Converting..." : "Confirm Conversion"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent Transactions
                </CardTitle>
                <CardDescription>Filter and view your transaction history</CardDescription>
              </div>
            </div>
            <Tabs value={transactionFilter} onValueChange={setTransactionFilter} className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="conversion">Conversions</TabsTrigger>
                <TabsTrigger value="outcome_reward">Outcome Rewards</TabsTrigger>
                <TabsTrigger value="redemption">Marketplace</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {(() => {
              const filteredTransactions = transactionFilter === "all" 
                ? transactions 
                : transactions.filter(t => t.source === transactionFilter);

              if (filteredTransactions.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No {transactionFilter !== "all" ? transactionFilter : ""} transactions yet</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {filteredTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          tx.source === 'outcome_reward' ? 'bg-green-100 dark:bg-green-900' :
                          tx.type === 'credit' 
                            ? 'bg-green-100 dark:bg-green-900' 
                            : 'bg-red-100 dark:bg-red-900'
                        }`}>
                          {tx.source === 'outcome_reward' ? (
                            <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : tx.type === 'credit' ? (
                            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{tx.description || tx.source}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {tx.timestamp?.toDate?.()?.toLocaleString() || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={tx.type === 'credit' ? 'default' : 'destructive'}>
                          {tx.type === 'credit' ? '+' : '-'}{tx.tokens} WC
                        </Badge>
                        {tx.hpUsed && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {tx.hpUsed} HP used
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
