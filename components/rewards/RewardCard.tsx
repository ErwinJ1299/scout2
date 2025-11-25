'use client';

import { RewardItem } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, Sparkles, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface RewardCardProps {
  reward: RewardItem;
  currentPoints: number;
  onRedeem: () => void;
}

export function RewardCard({ reward, currentPoints, onRedeem }: RewardCardProps) {
  const canAfford = currentPoints >= reward.pointsRequired;
  const pointsNeeded = reward.pointsRequired - currentPoints;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="h-full"
    >
      <Card className="h-full bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group">
        {/* Image */}
        <CardHeader className="p-0">
          <div className="relative h-48 bg-gradient-to-br from-purple-600/20 to-cyan-600/20 overflow-hidden">
            {reward.imageUrl ? (
              <Image
                src={reward.imageUrl}
                alt={reward.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Gift className="w-20 h-20 text-white/30" />
              </div>
            )}
            {!canAfford && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center">
                  <Lock className="w-12 h-12 text-white/80 mx-auto mb-2" />
                  <p className="text-white font-semibold">Need {pointsNeeded} more points</p>
                </div>
              </div>
            )}
            {reward.available && canAfford && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-green-500/90 text-white border-none shadow-lg">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Available
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          {/* Brand */}
          <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-400/50">
            {reward.brand}
          </Badge>

          {/* Name */}
          <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">
            {reward.name}
          </h3>

          {/* Points */}
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              {reward.pointsRequired.toLocaleString()}
            </div>
            <div className="text-white/60 text-sm">points</div>
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0">
          <Button
            onClick={onRedeem}
            disabled={!canAfford || !reward.available}
            className={`w-full font-semibold shadow-lg transition-all ${
              canAfford && reward.available
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {!reward.available ? (
              'Out of Stock'
            ) : canAfford ? (
              <>
                <Gift className="w-4 h-4 mr-2" />
                Redeem Now
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Locked
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
