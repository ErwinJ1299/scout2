'use client';

import * as React from 'react';
import {
  Activity,
  Bell,
  TrendingUp,
  Trophy,
  Plus,
  Heart,
  Calendar,
  User,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';

import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useAuthStore } from '@/lib/store/auth.store';
import { AuthService } from '@/lib/services/auth.service';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function PatientSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuthStore();
  const router = useRouter();

  const navMain = [
    {
      title: 'Dashboard',
      url: '/patient/dashboard',
      icon: LayoutDashboard,
      isActive: true,
    },
    {
      title: 'Health Data',
      url: '/patient/add-reading',
      icon: Activity,
      isActive: false,
    },
    {
      title: 'Reminders',
      url: '/patient/add-reminder',
      icon: Bell,
      isActive: false,
    },
    {
      title: 'Progress',
      url: '/patient/dashboard',
      icon: Trophy,
      isActive: false,
    },
  ];

  const quickActions = [
    {
      name: 'Log Health Data',
      url: '/patient/add-reading',
      icon: Plus,
    },
    {
      name: 'Add Reminder',
      url: '/patient/add-reminder',
      icon: Bell,
    },
  ];

  const userData = {
    name: user?.email?.split('@')[0] || 'Patient',
    email: user?.email || '',
    avatar: '/avatars/patient.jpg',
  };

  const handleSignOut = async () => {
    await AuthService.signOut();
    router.push('/login');
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/patient/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-teal-600 text-white">
                  <Heart className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Health Monitor</span>
                  <span className="truncate text-xs">Patient Portal</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        
        {/* Quick Actions */}
        <div className="px-3 py-2">
          <h4 className="mb-2 px-2 text-xs font-semibold text-gray-500 uppercase">Quick Actions</h4>
          <div className="space-y-1">
            {quickActions.map((action) => (
              <SidebarMenuButton key={action.name} asChild>
                <Link href={action.url} className="flex items-center gap-2">
                  <action.icon className="size-4" />
                  <span>{action.name}</span>
                </Link>
              </SidebarMenuButton>
            ))}
          </div>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} onSignOut={handleSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
