import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Crypto from 'expo-crypto';
import { supabase } from '../config/supabase';
import { PhotoAsset } from '../types';
import { reverseGeocode } from './geocoding';

// ============================================
// Hash Utilities (Duplicate Detection)
// ============================================

/**
 * Calculate SHA-256 hash of a file
 * @param uri - Local file URI
 * @returns Hex string of hash
 */
export async function calculateFileHash(uri: string): Promise<string> {
  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });

  // Calculate SHA-256 hash
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  return hash;
}

/**
 * Check which hashes already exist in database (batch query)
 * @param userId - User ID
 * @param hashes - Array of file hashes to check
 * @returns Set of existing hashes
 */
export async function checkDuplicateHashes(
  userId: string,
  hashes: string[]
): Promise<Set<string>> {
  if (!hashes || hashes.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('photos')
    .select('file_hash')
    .eq('user_id', userId)
    .in('file_hash', hashes);

  if (error) {
    console.error('Error checking duplicate hashes:', error);
    return new Set();
  }

  return new Set(data.map((row: { file_hash: string }) => row.file_hash));
}

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
  // Get EXIF data and location (may fail if ACCESS_MEDIA_LOCATION denied)
  let exifData: PhotoAsset['exif'] = undefined;
  try {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(asset, {
      shouldDownloadFromNetwork: false,
    });

    // GPS coordinates: prefer assetInfo.location (standard format), fallback to EXIF
    let gpsLatitude: number | undefined;
    let gpsLongitude: number | undefined;

    // Primary: assetInfo.location (expo-media-library standard format)
    if (assetInfo.location?.latitude && assetInfo.location?.longitude) {
      gpsLatitude = assetInfo.location.latitude;
      gpsLongitude = assetInfo.location.longitude;
    }
    // Fallback: EXIF data (varies by platform)
    else if (assetInfo.exif?.GPSLatitude && assetInfo.exif?.GPSLongitude) {
      gpsLatitude = assetInfo.exif.GPSLatitude as number;
      gpsLongitude = assetInfo.exif.GPSLongitude as number;
    }

    exifData = {
      DateTimeOriginal: assetInfo.exif?.DateTimeOriginal as string | undefined,
      GPSLatitude: gpsLatitude,
      GPSLongitude: gpsLongitude,
    };
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
 * @param userId - User ID
 * @param photo - Photo asset to upload
 * @param fileHash - Optional pre-calculated file hash
 */
export async function uploadPhoto(
  userId: string,
  photo: PhotoAsset,
  fileHash?: string | null
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

  // Insert record to database (with file_hash for duplicate detection)
  const { error: dbError } = await supabase
    .from('photos')
    .insert({
      user_id: userId,
      url: urlData.publicUrl,
      date_taken: dateTaken,
      location: location,
      file_hash: fileHash || null,
    });

  if (dbError) {
    // Rollback: delete uploaded file
    await supabase.storage.from('photos').remove([fileName]);
    console.error('Database error:', dbError);
    throw new Error('사진 정보 저장에 실패했습니다.');
  }
}

/**
 * Upload multiple photos with duplicate detection and progress tracking
 * @param userId - User ID
 * @param photos - Array of photo assets to upload
 * @param onProgress - Progress callback (current, total, status)
 * @returns Upload results with success, failed, and skipped counts
 */
export async function uploadPhotos(
  userId: string,
  photos: PhotoAsset[],
  onProgress?: (current: number, total: number, status: 'hashing' | 'uploading') => void
): Promise<{ success: number; failed: number; skipped: number }> {
  // Step 1: Calculate hashes for all photos
  const photosWithHash: Array<{ photo: PhotoAsset; hash: string | null }> = [];
  for (let i = 0; i < photos.length; i++) {
    try {
      const hash = await calculateFileHash(photos[i].uri);
      photosWithHash.push({ photo: photos[i], hash });
    } catch (err) {
      console.warn(`Hash calculation failed for ${photos[i].filename}:`, err);
      photosWithHash.push({ photo: photos[i], hash: null });
    }
    onProgress?.(i + 1, photos.length, 'hashing');
  }

  // Step 2: Check for duplicates (batch query)
  const hashes = photosWithHash
    .map(p => p.hash)
    .filter((h): h is string => h !== null);
  const existingHashes = await checkDuplicateHashes(userId, hashes);

  // Step 3: Filter out duplicates
  const photosToUpload: Array<{ photo: PhotoAsset; hash: string | null }> = [];
  let skipped = 0;
  for (const item of photosWithHash) {
    if (item.hash && existingHashes.has(item.hash)) {
      skipped++;
    } else {
      photosToUpload.push(item);
    }
  }

  // Step 4: Upload non-duplicate photos
  let success = 0;
  let failed = 0;

  for (let i = 0; i < photosToUpload.length; i++) {
    const { photo, hash } = photosToUpload[i];
    try {
      await uploadPhoto(userId, photo, hash);
      success++;
    } catch (error) {
      console.error(`Failed to upload photo ${photo.filename}:`, error);
      failed++;
    }
    onProgress?.(i + 1, photosToUpload.length, 'uploading');
  }

  return { success, failed, skipped };
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
