// User types
export interface User {
  id: string;
  email: string;
  user_metadata?: {
    username?: string;
    display_name?: string;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  user_id: string;
  avatar_url: string | null;
  created_at: string;
  last_sync_at: string | null;
}

// Photo types
export interface Photo {
  id: string;
  user_id: string;
  url: string;
  date_taken: string;
  location: string | null;
  created_at: string;
}

export interface PhotoAsset {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  modificationTime: number;
  width: number;
  height: number;
  mediaType: string;
  exif?: {
    DateTimeOriginal?: string;
    GPSLatitude?: number;
    GPSLongitude?: number;
  };
  selected: boolean;
  location?: string | null;
}

// Auth types
export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

// Gallery filter types
export interface GalleryFilter {
  startDate: Date | null;
  endDate: Date | null;
  locationSearch: string;
}

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Sync: undefined;
};
