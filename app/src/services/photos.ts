import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '../config/supabase';
import { PhotoAsset } from '../types';
import { reverseGeocode } from './geocoding';

/**
 * Request media library permission (including media location for EXIF GPS data)
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  // Request full media library permission including ACCESS_MEDIA_LOCATION
  const { status } = await MediaLibrary.requestPermissionsAsync(true);
  return status === 'granted';
}

/**
 * Get all albums including Downloads, Screenshots, etc.
 */
async function getAllAlbums(): Promise<MediaLibrary.Album[]> {
  const albums = await MediaLibrary.getAlbumsAsync({
    includeSmartAlbums: true,
  });
  return albums;
}

/**
 * Convert MediaLibrary asset to PhotoAsset with EXIF data
 */
async function assetToPhotoAsset(
  asset: MediaLibrary.Asset,
  selected: boolean = true
): Promise<PhotoAsset> {
  // Get EXIF data for GPS coordinates (may fail if ACCESS_MEDIA_LOCATION denied)
  let exifData: PhotoAsset['exif'] = undefined;
  try {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(asset, {
      shouldDownloadFromNetwork: false,
    });
    if (assetInfo.exif) {
      exifData = {
        DateTimeOriginal: assetInfo.exif.DateTimeOriginal as string | undefined,
        GPSLatitude: assetInfo.exif.GPSLatitude as number | undefined,
        GPSLongitude: assetInfo.exif.GPSLongitude as number | undefined,
      };
    }
  } catch (exifError) {
    console.warn(`EXIF read failed for ${asset.filename}:`, exifError);
  }

  return {
    id: asset.id,
    uri: asset.uri,
    filename: asset.filename,
    creationTime: asset.creationTime,
    modificationTime: asset.modificationTime,
    width: asset.width,
    height: asset.height,
    mediaType: asset.mediaType,
    exif: exifData,
    selected,
    location: null,
  };
}

/**
 * Fetch photos from device gallery after a specific date
 * Scans ALL albums including Downloads, Screenshots, etc.
 * Uses modificationTime to include downloaded/added images (not just camera photos)
 *
 * - Camera photos: modificationTime ≈ creationTime (when taken)
 * - Downloaded images: modificationTime = when downloaded/added to gallery
 * - Moved images: modificationTime = when moved to gallery
 */
export async function fetchPhotosAfterDate(
  afterDate: Date | null
): Promise<PhotoAsset[]> {
  const assetsMap = new Map<string, PhotoAsset>(); // Use Map to deduplicate by ID

  // First, scan without album filter (default behavior)
  let hasNextPage = true;
  let endCursor: string | undefined;

  while (hasNextPage) {
    const result = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
      first: 100,
      after: endCursor,
    });

    for (const asset of result.assets) {
      const assetTime = asset.modificationTime;
      if (afterDate && assetTime <= afterDate.getTime()) {
        continue;
      }
      if (!assetsMap.has(asset.id)) {
        const photoAsset = await assetToPhotoAsset(asset, true);
        assetsMap.set(asset.id, photoAsset);
      }
    }

    hasNextPage = result.hasNextPage;
    endCursor = result.endCursor;
  }

  // Then, scan specific albums that might be missed (Downloads, etc.)
  try {
    const albums = await getAllAlbums();
    const targetAlbumNames = ['download', 'downloads', '다운로드', 'telegram', 'whatsapp', 'kakaotalk'];

    for (const album of albums) {
      const albumNameLower = album.title.toLowerCase();
      if (targetAlbumNames.some(name => albumNameLower.includes(name))) {
        let albumHasNextPage = true;
        let albumEndCursor: string | undefined;

        while (albumHasNextPage) {
          const result = await MediaLibrary.getAssetsAsync({
            mediaType: MediaLibrary.MediaType.photo,
            sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
            first: 100,
            after: albumEndCursor,
            album: album,
          });

          for (const asset of result.assets) {
            const assetTime = asset.modificationTime;
            if (afterDate && assetTime <= afterDate.getTime()) {
              continue;
            }
            if (!assetsMap.has(asset.id)) {
              const photoAsset = await assetToPhotoAsset(asset, true);
              assetsMap.set(asset.id, photoAsset);
            }
          }

          albumHasNextPage = result.hasNextPage;
          albumEndCursor = result.endCursor;
        }
      }
    }
  } catch (albumError) {
    console.warn('Failed to scan specific albums:', albumError);
  }

  // Convert Map to array and sort by modificationTime (newest first)
  const assets = Array.from(assetsMap.values());
  assets.sort((a, b) => b.modificationTime - a.modificationTime);

  return assets;
}

/**
 * Generate unique filename for storage
 */
function generateFileName(userId: string, originalName: string): string {
  const ext = originalName.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${userId}/${timestamp}_${random}.${ext}`;
}

/**
 * Upload a single photo to Supabase
 */
export async function uploadPhoto(
  userId: string,
  photo: PhotoAsset,
  onProgress?: (progress: number) => void
): Promise<void> {
  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(photo.uri, {
    encoding: 'base64',
  });

  // Convert to Uint8Array
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Generate unique filename
  const fileName = generateFileName(userId, photo.filename);

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(fileName, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error('사진 업로드에 실패했습니다.');
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('photos')
    .getPublicUrl(fileName);

  // Prepare date
  // Priority: EXIF DateTimeOriginal > modificationTime > creationTime > now
  // Downloaded images often don't have EXIF data and creationTime may be 0
  let dateTaken: string;
  if (photo.exif?.DateTimeOriginal) {
    dateTaken = formatExifDate(photo.exif.DateTimeOriginal);
  } else if (photo.modificationTime && photo.modificationTime > 0) {
    dateTaken = new Date(photo.modificationTime).toISOString();
  } else if (photo.creationTime && photo.creationTime > 0) {
    dateTaken = new Date(photo.creationTime).toISOString();
  } else {
    // Fallback to current date if all timestamps are invalid
    dateTaken = new Date().toISOString();
  }

  // Get location via reverse geocoding if GPS available
  let location: string | null = photo.location;
  if (!location && photo.exif?.GPSLatitude && photo.exif?.GPSLongitude) {
    location = await reverseGeocode(photo.exif.GPSLatitude, photo.exif.GPSLongitude);
  }

  // Insert record to database
  const { error: dbError } = await supabase
    .from('photos')
    .insert({
      user_id: userId,
      url: urlData.publicUrl,
      date_taken: dateTaken,
      location: location,
    });

  if (dbError) {
    // Rollback: delete uploaded file
    await supabase.storage.from('photos').remove([fileName]);
    console.error('Database error:', dbError);
    throw new Error('사진 정보 저장에 실패했습니다.');
  }
}

/**
 * Upload multiple photos with progress tracking
 */
export async function uploadPhotos(
  userId: string,
  photos: PhotoAsset[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < photos.length; i++) {
    try {
      await uploadPhoto(userId, photos[i]);
      success++;
    } catch (error) {
      console.error(`Failed to upload photo ${photos[i].filename}:`, error);
      failed++;
    }

    onProgress?.(i + 1, photos.length);
  }

  return { success, failed };
}

/**
 * Format EXIF date string to ISO format
 * EXIF format: "2024:01:15 14:30:00" → ISO format
 */
function formatExifDate(exifDate: string): string {
  try {
    // Replace first two colons with dashes (date part)
    const formatted = exifDate.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    return new Date(formatted).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Fetch all photos from device gallery with pagination and optional date filter
 * Used for manual gallery picker
 * Includes photos from all albums (Downloads, Telegram, KakaoTalk, etc.)
 */
export async function fetchAllPhotos(options: {
  limit?: number;
  after?: string;
  createdAfter?: Date | null;
  createdBefore?: Date | null;
  includeAllAlbums?: boolean; // If true, scans all albums on first page
}): Promise<{
  photos: PhotoAsset[];
  hasNextPage: boolean;
  endCursor: string | undefined;
}> {
  const { limit = 50, after, createdAfter, createdBefore, includeAllAlbums = true } = options;

  // Build query options with date filters
  const queryOptions: MediaLibrary.AssetsOptions = {
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [[MediaLibrary.SortBy.modificationTime, false]], // Newest first by modification time
    first: limit,
    after: after,
  };

  // Add date range filter (native level filtering)
  if (createdAfter) {
    queryOptions.createdAfter = createdAfter.getTime();
  }
  if (createdBefore) {
    // Include the entire end date
    const endOfDay = new Date(createdBefore);
    endOfDay.setHours(23, 59, 59, 999);
    queryOptions.createdBefore = endOfDay.getTime();
  }

  // For first page load with includeAllAlbums, scan all albums
  if (!after && includeAllAlbums) {
    const assetsMap = new Map<string, PhotoAsset>();

    // First, scan without album filter
    const defaultResult = await MediaLibrary.getAssetsAsync(queryOptions);
    for (const asset of defaultResult.assets) {
      if (!assetsMap.has(asset.id)) {
        const photoAsset = await assetToPhotoAsset(asset, false);
        assetsMap.set(asset.id, photoAsset);
      }
    }

    // Then scan specific albums (Downloads, messengers, etc.)
    try {
      const albums = await getAllAlbums();
      const targetAlbumNames = ['download', 'downloads', '다운로드', 'telegram', 'whatsapp', 'kakaotalk'];

      for (const album of albums) {
        const albumNameLower = album.title.toLowerCase();
        if (targetAlbumNames.some(name => albumNameLower.includes(name))) {
          const albumResult = await MediaLibrary.getAssetsAsync({
            ...queryOptions,
            album: album,
            first: limit,
          });

          for (const asset of albumResult.assets) {
            if (!assetsMap.has(asset.id)) {
              const photoAsset = await assetToPhotoAsset(asset, false);
              assetsMap.set(asset.id, photoAsset);
            }
          }
        }
      }
    } catch (albumError) {
      console.warn('Failed to scan specific albums:', albumError);
    }

    // Convert to array and sort
    const photos = Array.from(assetsMap.values());
    photos.sort((a, b) => b.modificationTime - a.modificationTime);

    // Take only 'limit' number of photos
    const limitedPhotos = photos.slice(0, limit);

    return {
      photos: limitedPhotos,
      hasNextPage: photos.length > limit || defaultResult.hasNextPage,
      endCursor: defaultResult.endCursor,
    };
  }

  // Normal pagination (after first page)
  const result = await MediaLibrary.getAssetsAsync(queryOptions);
  const photos: PhotoAsset[] = [];

  for (const asset of result.assets) {
    const photoAsset = await assetToPhotoAsset(asset, false);
    photos.push(photoAsset);
  }

  return {
    photos,
    hasNextPage: result.hasNextPage,
    endCursor: result.endCursor,
  };
}
