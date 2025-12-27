'use client';

import { CommunityChallenge } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Droplets, Footprints, Moon, Activity, Users, Calendar, Target } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface ChallengeCardProps {
  challenge: CommunityChallenge;
  isJoined?: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
  onManage?: () => void;
  isDoctor?: boolean;
}

const metricIcons: Record<string, any> = {
  steps: Footprints,
  hydration: Droplets,
  sleep: Moon,
  custom: Activity,
};

const metricColors: Record<string, string> = {
  steps: 'from-blue-500 to-cyan-500',
  hydration: 'from-cyan-500 to-teal-500',
  sleep: 'from-purple-500 to-indigo-500',
  custom: 'from-pink-500 to-rose-500',
};

export function ChallengeCard({
  challenge,
  isJoined = false,
  onJoin,
  onLeave,
  onManage,
  isDoctor = false,
}: ChallengeCardProps) {
  const Icon = metricIcons[challenge.metricType];
  const gradientColor = metricColors[challenge.metricType];
  const isActive = challenge.status === 'active';
  const daysRemaining = Math.ceil((challenge.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02, y: -5 }}
      className="h-full"
    >
      <Card className="h-full bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group">
        <div className={`h-2 bg-gradient-to-r ${gradientColor}`} />
        
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${gradientColor} shadow-lg group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-white">
                  {challenge.title}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                    {isActive ? '🔥 Active' : '✅ Completed'}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-white/70 border-white/30">
                    <Users className="w-3 h-3 mr-1" />
                    {challenge.participants.length}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <CardDescription className="text-white/80 text-sm leading-relaxed">
            {challenge.description}
          </CardDescription>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/20">
              <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
                <Target className="w-3 h-3" />
                Goal
              </div>
              <div className="text-white font-bold text-lg">
                {challenge.goalValue.toLocaleString()}
                <span className="text-sm ml-1 text-white/60">
                  {challenge.metricType === 'steps' && 'steps'}
                  {challenge.metricType === 'hydration' && 'glasses'}
                  {challenge.metricType === 'sleep' && 'hours'}
                  {challenge.metricType === 'custom' && 'units'}
                </span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/20">
              <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
                <Calendar className="w-3 h-3" />
                {isActive ? 'Days Left' : 'Ended'}
              </div>
              <div className="text-white font-bold text-lg">
                {isActive ? `${daysRemaining}d` : format(challenge.endDate, 'MMM dd')}
              </div>
            </div>
          </div>

          <div className="text-xs text-white/60 flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            {format(challenge.startDate, 'MMM dd')} - {format(challenge.endDate, 'MMM dd, yyyy')}
          </div>

          <div className="pt-2">
            {isDoctor ? (
              <Button
                onClick={onManage}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg"
              >
                Manage Challenge
              </Button>
            ) : isJoined ? (
              <Button
                onClick={onLeave}
                variant="outline"
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-semibold"
              >
                Leave Challenge
              </Button>
            ) : isActive ? (
              <Button
                onClick={onJoin}
                className={`w-full bg-gradient-to-r ${gradientColor} text-white font-semibold shadow-lg hover:shadow-xl transition-all`}
              >
                Join Challenge 🚀
              </Button>
            ) : (
              <Button disabled className="w-full" variant="secondary">
                Challenge Ended
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
