/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Logo, LogoText } from '@/assets/Logo'
import { OrganizationPicker } from '@/components/Organizations/OrganizationPicker'
import {
  Sidebar as SidebarComponent,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { useTheme } from '@/contexts/ThemeContext'
import { FeatureFlags } from '@/enums/FeatureFlags'
import { RoutePath } from '@/enums/RoutePath'
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization'
import { useI18n } from '@/i18n/useI18n'
import { cn, getMetaKey } from '@/lib/utils'
import { OrganizationRolePermissionsEnum, OrganizationUserRoleEnum } from '@daytonaio/api-client'
import {
  ArrowRightIcon,
  Box,
  ChevronsUpDown,
  Container,
  HardDrive,
  Joystick,
  KeyRound,
  LockKeyhole,
  LogOut,
  MapPinned,
  Moon,
  PackageOpen,
  SearchIcon,
  Server,
  Settings,
  SquareUserRound,
  Sun,
  Users,
} from 'lucide-react'
import { useFeatureFlagEnabled } from 'posthog-js/react'
import React, { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CommandConfig, useCommandPaletteActions, useRegisterCommands } from './CommandPalette'
import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Kbd } from './ui/kbd'
import { ScrollArea } from './ui/scroll-area'
import { LanguageToggle } from './LanguageToggle'

interface SidebarProps {
  isBannerVisible: boolean
  version: string
}

interface SidebarItem {
  icon: React.ReactElement
  label: string
  path: RoutePath | string
  onClick?: () => void
}

const useNavCommands = (items: { label: string; path: RoutePath | string; onClick?: () => void }[]) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()

  const navCommands: CommandConfig[] = useMemo(
    () =>
      items
        .filter((item) => item.path !== pathname)
        .map((item) => ({
          id: `nav-${item.path}`,
          label: t('commandPalette.commands.goTo', { label: item.label }),
          icon: <ArrowRightIcon className="w-4 h-4" />,
          onSelect: () => navigate(item.path),
        })),
    [items, navigate, pathname, t],
  )

  useRegisterCommands(navCommands, {
    groupId: 'navigation',
    groupLabel: t('commandPalette.groups.navigation'),
    groupOrder: 1,
  })
}

export function Sidebar({ isBannerVisible, version }: SidebarProps) {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const { user, signoutRedirect } = useAuth()
  const { pathname } = useLocation()
  const sidebar = useSidebar()
  const { selectedOrganization, authenticatedUserOrganizationMember, authenticatedUserHasPermission } =
    useSelectedOrganization()
  // In Lite version, all feature flags are enabled by default
  const orgInfraEnabled = true
  const playgroundEnabled = useFeatureFlagEnabled(FeatureFlags.DASHBOARD_PLAYGROUND)

  const sidebarItems = useMemo(() => {
    const arr: SidebarItem[] = [
      {
        icon: <Container size={16} strokeWidth={1.5} />,
        label: t('sidebar.sandboxes'),
        path: RoutePath.SANDBOXES,
      },
      {
        icon: <Box size={16} strokeWidth={1.5} />,
        label: t('sidebar.snapshots'),
        path: RoutePath.SNAPSHOTS,
      },
      {
        icon: <PackageOpen size={16} strokeWidth={1.5} />,
        label: t('sidebar.registries'),
        path: RoutePath.REGISTRIES,
      },
    ]
    if (authenticatedUserHasPermission(OrganizationRolePermissionsEnum.READ_VOLUMES)) {
      arr.push({
        icon: <HardDrive size={16} strokeWidth={1.5} />,
        label: t('sidebar.volumes'),
        path: RoutePath.VOLUMES,
      })
    }

    return arr
  }, [authenticatedUserHasPermission, t])

  const settingsItems = useMemo(() => {
    const arr: SidebarItem[] = [
      {
        icon: <Settings size={16} strokeWidth={1.5} />,
        label: t('sidebar.settings'),
        path: RoutePath.SETTINGS,
      },
      { icon: <KeyRound size={16} strokeWidth={1.5} />, label: t('sidebar.apiKeys'), path: RoutePath.KEYS },
    ]

    if (authenticatedUserOrganizationMember?.role === OrganizationUserRoleEnum.OWNER) {
      arr.push({
        icon: <LockKeyhole size={16} strokeWidth={1.5} />,
        label: t('sidebar.limits'),
        path: RoutePath.LIMITS,
      })
    }
    if (!selectedOrganization?.personal) {
      arr.push({
        icon: <Users size={16} strokeWidth={1.5} />,
        label: t('sidebar.members'),
        path: RoutePath.MEMBERS,
      })
      // TODO: uncomment when we allow creating custom roles
      // if (authenticatedUserOrganizationMember?.role === OrganizationUserRoleEnum.OWNER) {
      //   arr.push({ icon: <UserCog className="w-5 h-5" />, label: 'Roles', path: RoutePath.ROLES })
      // }
    }

    return arr
  }, [authenticatedUserOrganizationMember?.role, selectedOrganization?.personal, t])

  const infrastructureItems = useMemo(() => {
    if (!orgInfraEnabled) {
      return []
    }

    const arr = [
      {
        icon: <MapPinned size={16} strokeWidth={1.5} />,
        label: t('sidebar.regions'),
        path: RoutePath.REGIONS,
      },
    ]

    if (authenticatedUserHasPermission(OrganizationRolePermissionsEnum.READ_RUNNERS)) {
      arr.push({
        icon: <Server size={16} strokeWidth={1.5} />,
        label: t('sidebar.runners'),
        path: RoutePath.RUNNERS,
      })
    }

    return arr
  }, [authenticatedUserHasPermission, orgInfraEnabled, t])

  const handleSignOut = () => {
    signoutRedirect()
  }

  const miscItems = useMemo(() => {
    if (!playgroundEnabled) {
      return []
    }

    return [
      playgroundEnabled && {
        icon: <Joystick size={16} strokeWidth={1.5} />,
        label: t('sidebar.playground'),
        path: RoutePath.PLAYGROUND,
      },
    ]
  }, [playgroundEnabled, t])

  const sidebarGroups: { label: string; items: SidebarItem[] }[] = useMemo(() => {
    return [
      { label: t('sidebar.groupSandboxes'), items: sidebarItems },
      {
        label: t('sidebar.groupMisc'),
        items: miscItems,
      },
      { label: t('sidebar.groupSettings'), items: settingsItems },
      { label: t('sidebar.groupInfrastructure'), items: infrastructureItems },
    ].filter((group) => group.items.length > 0)
  }, [infrastructureItems, miscItems, settingsItems, sidebarItems, t])

  const commandItems = useMemo(() => sidebarGroups.flatMap((group) => group.items), [sidebarGroups])

  const commandPaletteActions = useCommandPaletteActions()

  useNavCommands(commandItems)

  const metaKey = getMetaKey()

  return (
    <SidebarComponent isBannerVisible={isBannerVisible} collapsible="icon">
      <SidebarHeader>
        <div
          className={cn('flex justify-between items-center gap-2 px-2 mb-2 h-12', {
            'justify-center px-0': !sidebar.open,
          })}
        >
          <div className="flex items-center gap-2 group-data-[state=collapsed]:hidden text-primary">
            <Logo />
            <LogoText />
          </div>
          <SidebarTrigger className="p-2 [&_svg]:size-5" />
        </div>
        <SidebarMenu>
          <OrganizationPicker />
          <SidebarMenuItem className="mb-1">
            <SidebarMenuButton
              tooltip={t('sidebar.searchWithShortcut', { shortcut: `${metaKey}+K` })}
              variant="outline"
              className="flex items-center gap-2 justify-between dark:bg-input/30 dark:hover:bg-sidebar-accent hover:shadow-[0_0_0_1px_hsl(var(--sidebar-border))]"
              onClick={() => commandPaletteActions.setIsOpen(true)}
            >
              <span className="flex items-center gap-2">
                <SearchIcon className="w-4 h-4" /> {t('common.search')}
              </span>
              <Kbd className="whitespace-nowrap">{metaKey} K</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea fade="shadow" className="overflow-auto flex-1">
          {sidebarGroups.map((group, i) => (
            <React.Fragment key={group.label}>
              {i > 0 && <SidebarSeparator />}
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname.startsWith(item.path)}
                          className="text-sm"
                          tooltip={item.label}
                        >
                          {item.onClick ? (
                            <button onClick={() => item.onClick?.()}>
                              {item.icon}
                              <span>{item.label}</span>
                            </button>
                          ) : (
                            <Link to={item.path}>
                              {item.icon}
                              <span>{item.label}</span>
                            </Link>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </React.Fragment>
          ))}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="pb-4">
        <SidebarMenu>
          <SidebarMenuItem key="theme-toggle">
            <SidebarMenuButton
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-8 py-0"
              title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
              tooltip={t('common.toggleTheme')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem key="language-toggle">
            <LanguageToggle compact={!sidebar.open} sidebarStyle className="h-8 py-0" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className={cn(
                    'flex flex-shrink-0 items-center outline outline-1 outline-border outline-offset-0 bg-muted font-medium mt-2',
                    {
                      'h-12': sidebar.open,
                    },
                  )}
                  tooltip={t('common.profile')}
                >
                  {user?.profile.picture ? (
                    <img
                      src={user.profile.picture}
                      alt={user.profile.name || 'Profile picture'}
                      className="h-4 w-4 rounded-sm flex-shrink-0"
                    />
                  ) : (
                    <SquareUserRound className="!w-4 !h-4  flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="truncate block">{user?.profile.name || ''}</span>
                    <span className="truncate block text-muted-foreground text-xs">{user?.profile.email || ''}</span>
                  </div>
                  <ChevronsUpDown className="w-4 h-4 opacity-50 flex-shrink-0" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-[--radix-popper-anchor-width] min-w-[12rem]">
                <DropdownMenuItem asChild>
                  <Button variant="ghost" className="w-full cursor-pointer justify-start" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4" />
                    {t('common.signOut')}
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem key="version">
            <div
              className={cn(
                'flex items-center w-full justify-center gap-2 mt-2 overflow-auto min-h-4 whitespace-nowrap',
              )}
            >
              {sidebar.open && (
                <span className="text-xs text-muted-foreground">{t('common.version', { version })}</span>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarComponent>
  )
}
