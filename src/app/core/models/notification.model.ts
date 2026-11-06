/** In-app notification model */
export interface AppNotification {
  id: string;
  userId: string;
  type: 'budget' | 'goal' | 'sip' | 'price';
  message: string;
  read: boolean;
  createdAt: string; // ISO date string
}
