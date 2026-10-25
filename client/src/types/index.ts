export type UserRole = 'customer' | 'studio' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Painting {
  id: string;
  title: string;
  artist: string;
  description: string;
  price: number;
  imageUrl: string;
  status: 'available' | 'sold';
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  customerId: string;
  paintingId: string;
  price: number;
  status: 'placed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
  customerName?: string;
  customerEmail?: string;
  paintingTitle?: string;
  paintingArtist?: string;
  paintingImageUrl?: string;
}

export interface WallBooking {
  id: string;
  customerId: string;
  bookingDate: string;
  wallSizeSqFt: number;
  address: string;
  ratePerSqFt: number;
  price: number;
  status: 'requested' | 'confirmed' | 'declined' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
  customerName?: string;
  customerEmail?: string;
}

export interface PotteryItem {
  id: string;
  name: string;
}

export interface PotteryGlaze {
  id: string;
  name: string;
}

export interface PotteryRequest {
  id: string;
  customerId: string;
  itemId: string;
  glazeId: string;
  quantity: number;
  neededByDate: string;
  status: 'requested' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
  itemName?: string;
  glazeName?: string;
  customerName?: string;
  customerEmail?: string;
}
