// The four sub-filters, as the desktop's parted rail has them (SPEC §3.5):
// their order, names and glyphs, shared by the drawer's band
// (PlaceBand.svelte) and the list's filter bar (RoomListScreen.svelte).

import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
import HashIcon from 'phosphor-svelte/lib/HashIcon';
import StackIcon from 'phosphor-svelte/lib/StackIcon';
import UserIcon from 'phosphor-svelte/lib/UserIcon';
import type { Component } from 'svelte';
import type { Filter } from './place.js';

export interface FilterInfo {
  value: Filter;
  label: string;
  icon: Component;
}

export const FILTERS: readonly FilterInfo[] = [
  { value: 'all', label: 'All chats', icon: StackIcon },
  { value: 'rooms', label: 'Rooms', icon: HashIcon },
  { value: 'dms', label: 'Direct messages', icon: UserIcon },
  { value: 'recent', label: 'Recent', icon: ClockIcon },
];
