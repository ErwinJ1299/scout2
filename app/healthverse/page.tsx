'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { FirestoreService } from '@/lib/services/firestore.service';
import {
  CommunityChallenge,
  ChallengeProgress,
  RewardItem,
  RewardWallet,
  Patient,
  Doctor,
} from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ChallengeCard } from '@/components/challenges/ChallengeCard';
import { CreateChallengeDialog } from '@/components/challenges/CreateChallengeDialog';
import { LeaderboardCard } from '@/components/challenges/LeaderboardCard';
import { RewardCard } from '@/components/rewards/RewardCard';
import { WalletDisplay } from '@/components/rewards/WalletDisplay';
import { Loader2, Plus, Sparkles, Trophy, Gift, TrendingUp, Target, Zap, } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function HealthVersePage() {
  const { user, loading: authLoading } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  const [userRole, setUserRole] = useState<'doctor' | 'patient' | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [challenges, setChallenges] = useState<CommunityChallenge[]>([]);
  const [myProgress, setMyProgress] = useState<ChallengeProgress[]>([]);
  const [selectedChallengeProgress, setSelectedChallengeProgress] = useState<ChallengeProgress[]>([]);
  const [challengeLeaderboards, setChallengeLeaderboards] = useState<Record<string, ChallengeProgress[]>>({});
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<CommunityChallenge | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [wallet, setWallet] = useState<RewardWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  // Load user data and determine role
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const loadUserData = async () => {
      try {
        // Try to load as doctor first
        const doctorData = await FirestoreService.getDoctor(user.uid);
        if (doctorData) {
          console.log('Doctor loaded:', doctorData);
          setUserRole('doctor');
          setDoctor(doctorData);
          setLoading(false);
          return;
        }

        // Try to load as patient
        const patientData = await FirestoreService.getPatient(user.uid);
        if (patientData) {
          console.log('Patient loaded:', patientData);
          setUserRole('patient');
          setPatient(patientData);
          
          // Initialize wallet
          const walletData = await FirestoreService.getOrCreateWallet(user.uid);
          setWallet(walletData);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading user data:', error);
        setLoading(false);
      }
    };

    loadUserData();
  }, [user, authLoading, router]);

  // Subscribe to challenges
  useEffect(() => {
    if (!user) return;

    const unsubscribe = FirestoreService.subscribeToChallenges('active', (data) => {
      // Filter out expired challenges (where endDate has passed)
      const now = new Date();
      const activeChallenges = data.filter(challenge => {
        const endDate = new Date(challenge.endDate);
        return endDate >= now;
      });
      
      // Auto-update expired challenges to 'completed' status
      data.forEach(async (challenge) => {
        const endDate = new Date(challenge.endDate);
        if (endDate < now && challenge.status === 'active') {
          try {
            await FirestoreService.updateChallenge(challenge.id, { status: 'completed' });
          } catch (error) {
            console.error('Error updating expired challenge:', error);
          }
        }
      });
      
      setChallenges(activeChallenges);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to patient's progress and leaderboards
  useEffect(() => {
    if (!user || userRole !== 'patient') return;

    const unsubscribes: (() => void)[] = [];

    const loadProgress = async () => {
      try {
        const progressData = await FirestoreService.getPatientChallengeProgress(user.uid);
        console.log('Patient progress data:', progressData);
        setMyProgress(progressData);
        
        // Subscribe to leaderboards for each challenge
        progressData.forEach((progress) => {
          console.log('Subscribing to leaderboard for challenge:', progress.challengeId);
          const unsubscribe = FirestoreService.subscribeToChallengeProgress(
            progress.challengeId, 
            (leaderboardData) => {
              console.log(`Leaderboard data for ${progress.challengeId}:`, leaderboardData);
              setChallengeLeaderboards(prev => {
                const updated = {
                  ...prev,
                  [progress.challengeId]: leaderboardData
                };
                console.log('Updated challengeLeaderboards:', updated);
                return updated;
              });
            }
          );
          unsubscribes.push(unsubscribe);
        });
      } catch (error) {
        console.error('Error loading progress:', error);
      }
    };

    loadProgress();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, userRole]);

  // Subscribe to rewards
  useEffect(() => {
    if (!user) return;

    const unsubscribe = FirestoreService.subscribeToRewards((data) => {
      setRewards(data);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to wallet
  useEffect(() => {
    if (!user || userRole !== 'patient') return;

    const unsubscribe = FirestoreService.subscribeToWallet(user.uid, (data) => {
      setWallet(data);
    });

    return () => unsubscribe();
  }, [user, userRole]);

  // Helper function to reload challenges
  const loadChallenges = async () => {
    // This will be handled by the useEffect subscription
    // Just a placeholder for manual refresh if needed
  };

  // Handle joining a challenge
  const handleJoinChallenge = async (challengeId: string) => {
    if (!user || userRole !== 'patient') {
      console.error("Cannot join challenge: user or userRole mismatch", { user, userRole });
      return;
    }

    try {
      console.log("Attempting to join challenge:", { challengeId, userId: user.uid, userRole });
      await FirestoreService.joinChallenge(challengeId, user.uid);
      
      // Show confetti animation
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      toast({
        title: '🎉 Challenge Joined!',
        description: 'You\'ve successfully joined the challenge. Good luck!',
      });

      console.log("Successfully joined challenge:", challengeId);
      
      // Reload progress
      const progressData = await FirestoreService.getPatientChallengeProgress(user.uid);
      setMyProgress(progressData);
    } catch (error: any) {
      console.error('Error joining challenge:', {
        error,
        errorMessage: error?.message,
        challengeId,
        userId: user.uid,
        userRole
      });
      toast({
        title: 'Error',
        description: error?.message || 'Failed to join challenge. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle leaving a challenge
  const handleLeaveChallenge = async (challengeId: string) => {
    if (!user || userRole !== 'patient') return;

    try {
      await FirestoreService.leaveChallenge(challengeId, user.uid);
      toast({
        title: 'Challenge Left',
        description: 'You\'ve left the challenge.',
      });

      // Reload progress
      const progressData = await FirestoreService.getPatientChallengeProgress(user.uid);
      setMyProgress(progressData);
    } catch (error) {
      console.error('Error leaving challenge:', error);
      toast({
        title: 'Error',
        description: 'Failed to leave challenge. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle viewing challenge leaderboard
  const handleViewLeaderboard = async (challengeId: string) => {
    setSelectedChallengeId(challengeId);
    const unsubscribe = FirestoreService.subscribeToChallengeProgress(challengeId, (data) => {
      setSelectedChallengeProgress(data);
    });
  };

  // Handle managing a challenge (for doctors)
  const handleManageChallenge = async (challenge: CommunityChallenge) => {
    if (!user || userRole !== 'doctor') return;
    
    setSelectedChallenge(challenge);
    setSelectedChallengeId(challenge.id);
    setIsManageDialogOpen(true);
    
    // Load leaderboard data
    const unsubscribe = FirestoreService.subscribeToChallengeProgress(challenge.id, (data) => {
      setSelectedChallengeProgress(data);
    });
  };

  // Handle closing a challenge (for doctors)
  const handleCloseChallenge = async () => {
    if (!selectedChallenge || !user || userRole !== 'doctor') return;
    
    try {
      await FirestoreService.closeChallenge(selectedChallenge.id);
      toast({
        title: 'Challenge Closed',
        description: 'The challenge has been closed successfully.',
      });
      setIsManageDialogOpen(false);
      setSelectedChallenge(null);
      await loadChallenges();
    } catch (error) {
      console.error('Error closing challenge:', error);
      toast({
        title: 'Error',
        description: 'Failed to close challenge. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle deleting a challenge (for doctors)
  const handleDeleteChallenge = async () => {
    if (!selectedChallenge || !user || userRole !== 'doctor') return;
    
    try {
      await FirestoreService.deleteChallenge(selectedChallenge.id);
      toast({
        title: 'Challenge Deleted',
        description: 'The challenge has been deleted successfully.',
      });
      setIsManageDialogOpen(false);
      setSelectedChallenge(null);
      await loadChallenges();
    } catch (error) {
      console.error('Error deleting challenge:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete challenge. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle redeeming reward
  const handleRedeemReward = async (reward: RewardItem) => {
    if (!user || !patient) return;

    try {
      await FirestoreService.redeemReward(user.uid, reward);
      
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
      });

      toast({
        title: '🎁 Reward Redeemed!',
        description: `You've successfully redeemed ${reward.name}!`,
      });

      // Sync wallet points
      await FirestoreService.syncWalletPoints(user.uid);
    } catch (error: any) {
      console.error('Error redeeming reward:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to redeem reward. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  const isDoctor = userRole === 'doctor';
  const joinedChallengeIds = myProgress.map((p) => p.challengeId);

  return (
    <div className="min-h-screen text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-purple-600/30 animate-pulse" />
        <div className="relative container mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-6"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="w-12 h-12 text-yellow-400" />
              </motion.div>
              <h1 className="text-6xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                HealthVerse 🌍
              </h1>
            </div>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Join health challenges, earn rewards, and stay motivated on your wellness journey!
            </p>
            
            {/* Animated Badges */}
            <div className="flex justify-center gap-6 mt-8">
              {[
                { icon: Trophy, label: 'Compete', color: 'from-yellow-400 to-orange-500' },
                { icon: Target, label: 'Achieve', color: 'from-green-400 to-emerald-500' },
                { icon: Gift, label: 'Rewards', color: 'from-purple-400 to-pink-500' },
                { icon: Zap, label: 'Energy', color: 'from-cyan-400 to-blue-500' },
              ].map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.2, rotate: 5 }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br ${item.color} shadow-lg`}
                >
                  <item.icon className="w-8 h-8 text-white" />
                  <span className="text-white font-semibold text-sm">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12 max-w-[1600px]">
        <Tabs defaultValue="challenges" className="space-y-8">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 bg-white/10 backdrop-blur-lg border border-white/20 p-1">
            <TabsTrigger value="challenges" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600">
              <Trophy className="w-4 h-4 mr-2" />
              Challenges
            </TabsTrigger>
            <TabsTrigger value="progress" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600">
              <TrendingUp className="w-4 h-4 mr-2" />
              My Progress
            </TabsTrigger>
            <TabsTrigger value="rewards" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-purple-600">
              <Gift className="w-4 h-4 mr-2" />
              Rewards
            </TabsTrigger>
          </TabsList>

          {/* Active Challenges Tab */}
          <TabsContent value="challenges" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-white">Active Challenges</h2>
              {isDoctor && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-semibold shadow-lg"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Challenge
                </Button>
              )}
            </div>

            {challenges.length === 0 ? (
              <div className="text-center py-20 text-white/60">
                <Trophy className="w-20 h-20 mx-auto mb-4 opacity-30" />
                <p className="text-xl font-medium">No active challenges yet</p>
                {isDoctor && (
                  <p className="text-sm mt-2">Create the first challenge to get started!</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {challenges.map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    isJoined={joinedChallengeIds.includes(challenge.id)}
                    onJoin={() => handleJoinChallenge(challenge.id)}
                    onLeave={() => handleLeaveChallenge(challenge.id)}
                    onManage={() => handleManageChallenge(challenge)}
                    isDoctor={isDoctor}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* My Progress Tab */}
          <TabsContent value="progress" className="space-y-6">
            <h2 className="text-3xl font-bold text-white">My Progress</h2>

            {!isDoctor && myProgress.length === 0 ? (
              <div className="text-center py-20 text-white/60">
                <TrendingUp className="w-20 h-20 mx-auto mb-4 opacity-30" />
                <p className="text-xl font-medium">No challenges joined yet</p>
                <p className="text-sm mt-2">Join a challenge to start tracking your progress!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {myProgress.map((progress) => {
                  const challenge = challenges.find((c) => c.id === progress.challengeId);
                  // Skip if challenge not found or is expired
                  if (!challenge) return null;
                  
                  // Double-check the challenge hasn't expired
                  const now = new Date();
                  const endDate = new Date(challenge.endDate);
                  if (endDate < now) return null;

                  const leaderboardData = challengeLeaderboards[challenge.id];
                  console.log('Rendering challenge:', challenge.id);
                  console.log('Has leaderboard data:', !!leaderboardData);
                  console.log('Leaderboard data:', leaderboardData);
                  console.log('Fallback to progress:', !leaderboardData ? [progress] : null);

                  return (
                    <div key={progress.id} className="flex flex-col xl:flex-row gap-6">
                      <div className="xl:w-[480px] flex-shrink-0">
                        <ChallengeCard
                          challenge={challenge}
                          isJoined={true}
                          onLeave={() => handleLeaveChallenge(challenge.id)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        {leaderboardData && leaderboardData.length > 0 ? (
                          <LeaderboardCard
                            progress={leaderboardData}
                            currentUserId={user?.uid}
                          />
                        ) : (
                          <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-lg rounded-xl p-8 border border-white/10 h-full flex items-center justify-center min-h-[300px]">
                            <div>
                              <p className="text-white text-center text-lg">Loading leaderboard...</p>
                              <p className="text-white/60 text-sm text-center mt-2">
                                {leaderboardData ? 'No participants yet' : 'Fetching data...'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isDoctor && selectedChallengeId && (
              <div>
                <h3 className="text-2xl font-bold text-white mb-4">Challenge Leaderboard</h3>
                <LeaderboardCard progress={selectedChallengeProgress} />
              </div>
            )}
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards" className="space-y-8">
            {!isDoctor && wallet && (
              <WalletDisplay wallet={wallet} totalEarnedPoints={patient?.points || 0} />
            )}

            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Reward Marketplace</h2>
              {rewards.length === 0 ? (
                <div className="text-center py-20 text-white/60">
                  <Gift className="w-20 h-20 mx-auto mb-4 opacity-30" />
                  <p className="text-xl font-medium">No rewards available yet</p>
                  <p className="text-sm mt-2">Check back soon for exciting rewards!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {rewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      currentPoints={patient?.points || 0}
                      onRedeem={() => handleRedeemReward(reward)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Challenge Dialog */}
      {isDoctor && doctor && (
        <CreateChallengeDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          doctorId={doctor.id}
        />
      )}

      {/* Manage Challenge Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              Manage Challenge
            </DialogTitle>
          </DialogHeader>
          
          {selectedChallenge && (
            <div className="space-y-6">
              {/* Challenge Details */}
              <div className="bg-gradient-to-br from-slate-800/40 to-purple-900/30 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white">{selectedChallenge.title}</h3>
                  <p className="text-gray-300">{selectedChallenge.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="bg-purple-900/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Target</p>
                      <p className="text-white font-bold">{selectedChallenge.goalValue} {selectedChallenge.metricType}</p>
                    </div>
                    <div className="bg-purple-900/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Duration</p>
                      <p className="text-white font-bold">{Math.ceil((new Date(selectedChallenge.endDate).getTime() - new Date(selectedChallenge.startDate).getTime()) / (1000 * 60 * 60 * 24))} days</p>
                    </div>
                    <div className="bg-purple-900/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Participants</p>
                      <p className="text-white font-bold">{selectedChallenge.participants.length || 0}</p>
                    </div>
                    <div className="bg-purple-900/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs">Status</p>
                      <p className={`font-bold ${
                        selectedChallenge.status === 'active' ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {selectedChallenge.status}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h4 className="text-lg font-bold text-white mb-4">Leaderboard</h4>
                {selectedChallengeProgress.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No participants yet</p>
                ) : (
                  <div className="space-y-3">
                    {selectedChallengeProgress
                      .sort((a, b) => b.pointsEarned - a.pointsEarned)
                      .slice(0, 10)
                      .map((progress, index) => (
                        <div
                          key={progress.patientId}
                          className="flex items-center justify-between bg-purple-900/30 rounded-lg p-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                              index === 0 ? 'bg-yellow-500 text-black' :
                              index === 1 ? 'bg-gray-400 text-black' :
                              index === 2 ? 'bg-amber-700 text-white' :
                              'bg-white/10 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-white font-semibold">Patient {progress.patientId.slice(-6)}</p>
                              <p className="text-gray-400 text-sm">
                                {progress.progressValue} / {selectedChallenge.goalValue} {selectedChallenge.metricType}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-cyan-400 font-bold">{progress.pointsEarned} pts</p>
                            <p className="text-gray-400 text-sm">{((progress.progressValue / selectedChallenge.goalValue) * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Management Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCloseChallenge}
                  disabled={selectedChallenge.status === 'completed'}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Close Challenge
                </Button>
                <Button
                  onClick={handleDeleteChallenge}
                  variant="destructive"
                  className="flex-1"
                >
                  Delete Challenge
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
