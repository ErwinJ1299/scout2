'use client';

import { ChallengeProgress } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface LeaderboardCardProps {
  progress: ChallengeProgress[];
  currentUserId?: string;
}

const rankColors = {
  1: 'from-yellow-400 to-yellow-600',
  2: 'from-gray-400 to-gray-600',
  3: 'from-orange-400 to-orange-600',
};

const rankIcons = {
  1: Trophy,
  2: Medal,
  3: Award,
};

export function LeaderboardCard({ progress, currentUserId }: LeaderboardCardProps) {
  // Sort by points earned (descending) and assign ranks
  const sortedProgress = [...progress].sort((a, b) => b.pointsEarned - a.pointsEarned);
  const topProgress = sortedProgress.slice(0, 10);
  const currentUserProgress = sortedProgress.find(p => p.patientId === currentUserId);
  const currentUserRank = sortedProgress.findIndex(p => p.patientId === currentUserId) + 1;

  console.log('LeaderboardCard - progress:', progress);
  console.log('LeaderboardCard - sortedProgress:', sortedProgress);
  console.log('LeaderboardCard - topProgress:', topProgress);

  return (
    <Card className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 backdrop-blur-lg border-white/20 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-white">Leaderboard</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {topProgress.length === 0 ? (
          <div className="text-center py-8 text-white/60">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No participants yet. Be the first to join!</p>
          </div>
        ) : (
          <>
            {topProgress.map((item, index) => {
              const rank = index + 1;
              const isCurrentUser = item.patientId === currentUserId;
              const RankIcon = rankIcons[rank as keyof typeof rankIcons];
              const rankGradient = rankColors[rank as keyof typeof rankColors];

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <div
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-cyan-500/30 to-purple-600/30 border-2 border-cyan-400/50 shadow-lg'
                        : 'bg-purple-800/30 hover:bg-purple-700/40 border border-purple-500/20'
                    }`}
                  >
                    {/* Rank */}
                    <div className="relative">
                      {rank <= 3 && RankIcon ? (
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${rankGradient} shadow-lg`}>
                          <RankIcon className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-purple-700/40 flex items-center justify-center border border-purple-500/30">
                          <span className="text-white font-bold text-sm">{rank}</span>
                        </div>
                      )}
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-10 w-10 border-2 border-white/20">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                        {item.patientId.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold truncate">
                          {isCurrentUser ? 'You' : `Player ${item.patientId.substring(0, 6)}`}
                        </p>
                        {item.completed && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/50 text-xs">
                            ✓ Complete
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-purple-950/50 rounded-full overflow-hidden border border-purple-500/20">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((item.progressValue / 10000) * 100, 100)}%` }}
                            transition={{ duration: 0.5, delay: index * 0.05 }}
                            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
                          />
                        </div>
                        <span className="text-xs text-cyan-300 whitespace-nowrap font-semibold">
                          {item.progressValue.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-right">
                      <div className="text-cyan-300 font-bold text-lg">
                        {item.pointsEarned}
                      </div>
                      <div className="text-purple-300 text-xs font-medium">points</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Current User Not in Top 10 */}
            {currentUserProgress && currentUserRank > 10 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-3 border-t border-purple-500/30"
              >
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-cyan-500/30 to-purple-600/30 border-2 border-cyan-400/50">
                  <div className="w-9 h-9 rounded-lg bg-purple-700/40 flex items-center justify-center border border-purple-500/30">
                    <span className="text-white font-bold text-sm">{currentUserRank}</span>
                  </div>
                  <Avatar className="h-10 w-10 border-2 border-cyan-400/50">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      YOU
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-white font-semibold">Your Position</p>
                    <p className="text-cyan-300 text-sm font-medium">{currentUserProgress.progressValue.toLocaleString()} progress</p>
                  </div>
                  <div className="text-right">
                    <div className="text-cyan-300 font-bold text-lg">{currentUserProgress.pointsEarned}</div>
                    <div className="text-purple-300 text-xs font-medium">points</div>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
