import type { IconName } from './components';

export const STORE_ICONS: Record<string, IconName> = {
  cvs: 'storefront-outline',
  drink: 'cafe-outline',
  breakfast: 'egg-outline',
  pharmacy: 'medkit-outline',
  market: 'basket-outline',
  buffet: 'restaurant-outline',
  salon: 'cut-outline',
  other: 'business-outline',
};

export const storeIcon = (id: string): IconName => STORE_ICONS[id] ?? 'business-outline';
