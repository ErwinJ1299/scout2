'use client';

import { RewardWallet, ClaimedReward } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Gift, TrendingUp, Calendar, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface WalletDisplayProps {
  wallet: RewardWallet;
  totalEarnedPoints: number;
}

export function WalletDisplay({ wallet, totalEarnedPoints }: WalletDisplayProps) {
  const recentRewards = wallet.rewardsClaimed.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 backdrop-blur-lg border-cyan-500/30 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-sm font-medium">Current Points</p>
                  <p className="text-3xl font-bold text-white">{wallet.currentPoints.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 backdrop-blur-lg border-purple-500/30 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-sm font-medium">Total Earned</p>
                  <p className="text-3xl font-bold text-white">{totalEarnedPoints.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 backdrop-blur-lg border-orange-500/30 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-sm font-medium">Points Spent</p>
                  <p className="text-3xl font-bold text-white">{wallet.totalPointsSpent.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Claimed Rewards History */}
      <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border-white/20 shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-xl font-bold text-white">
              Claimed Rewards
              <Badge className="ml-3 bg-green-500/20 text-green-400 border-green-500/50">
                {wallet.rewardsClaimed.length} total
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent>
          {wallet.rewardsClaimed.length === 0 ? (
            <div className="text-center py-12 text-white/60">
              <Gift className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No rewards claimed yet</p>
              <p className="text-sm mt-2">Start earning points and redeem amazing rewards!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRewards.map((reward, index) => (
                <motion.div
                  key={`${reward.rewardId}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                >
                  <div className="p-3 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                    <Gift className="w-5 h-5 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold truncate">{reward.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-400/50">
                        {reward.brand}
                      </Badge>
                      <div className="flex items-center gap-1 text-white/60 text-xs">
                        <Calendar className="w-3 h-3" />
                        {format(reward.dateClaimed, 'MMM dd, yyyy')}
                      </div>
                    </div>
                  </div>

                  <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                    Redeemed ✓
                  </Badge>
                </motion.div>
              ))}

              {wallet.rewardsClaimed.length > 5 && (
                <p className="text-center text-white/60 text-sm pt-2">
                  And {wallet.rewardsClaimed.length - 5} more reward{wallet.rewardsClaimed.length - 5 !== 1 ? 's' : ''}...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
