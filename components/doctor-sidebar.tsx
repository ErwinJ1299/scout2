'use client';

import * as React from 'react';
import {
  Users,
  LayoutDashboard,
  FileText,
  Settings,
  Stethoscope,
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

export function DoctorSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuthStore();
  const router = useRouter();

  const handleSignOut = async () => {
    await AuthService.signOut();
    router.push('/login');
  };

  const navMain = [
    {
      title: 'Dashboard',
      url: '/doctor/dashboard',
      icon: LayoutDashboard,
      isActive: true,
    },
    {
      title: 'Patients',
      url: '/doctor/dashboard',
      icon: Users,
      isActive: false,
    },
    {
      title: 'Clinical Notes',
      url: '/doctor/dashboard',
      icon: FileText,
      isActive: false,
    },
  ];

  const userData = {
    name: user?.email?.split('@')[0] || 'Doctor',
    email: user?.email || '',
    avatar: '/avatars/doctor.jpg',
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/doctor/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Stethoscope className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Health Monitor</span>
                  <span className="truncate text-xs">Doctor Portal</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} onSignOut={handleSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
