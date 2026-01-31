/**
 * EXIF Parser Utility
 * Extracts date and GPS location from image files
 * Includes reverse geocoding for location names
 */

// Cache for reverse geocoding results to avoid duplicate API calls
const geocodeCache = new Map();

/**
 * Extract EXIF data from an image file
 * @param {File} file - Image file
 * @returns {Promise<{date: string|null, location: string|null, latitude: number|null, longitude: number|null}>}
 */
export async function extractExifData(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const view = new DataView(e.target.result);
            const result = parseExif(view);
            resolve(result);
        };

        reader.onerror = () => {
            resolve({ date: null, location: null, latitude: null, longitude: null });
        };

        // Read first 128KB (enough for EXIF)
        const slice = file.slice(0, 128 * 1024);
        reader.readAsArrayBuffer(slice);
    });
}

/**
 * Reverse geocode GPS coordinates to location name
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string|null>} Location name (city/district level)
 */
export async function reverseGeocode(latitude, longitude) {
    if (latitude === null || longitude === null) {
        return null;
    }

    // Round coordinates to reduce API calls (approximately 1km precision)
    const roundedLat = Math.round(latitude * 100) / 100;
    const roundedLon = Math.round(longitude * 100) / 100;
    const cacheKey = `${roundedLat},${roundedLon}`;

    // Check cache first
    if (geocodeCache.has(cacheKey)) {
        return geocodeCache.get(cacheKey);
    }

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&accept-language=ko`,
            {
                headers: {
                    'User-Agent': 'Platypus Photo App'
                }
            }
        );

        if (!response.ok) {
            console.warn('Geocoding API error:', response.status);
            return null;
        }

        const data = await response.json();
        const address = data.address;

        // Build location string (city/district level only)
        let location = null;
        if (address) {
            const parts = [];

            // Country
            if (address.country) {
                // For Korea, use shorter format
                if (address.country === '대한민국' || address.country === 'South Korea') {
                    // City/Province level
                    if (address.city) {
                        parts.push(address.city);
                    } else if (address.province || address.state) {
                        parts.push(address.province || address.state);
                    }

                    // District level
                    if (address.borough || address.suburb || address.district || address.town) {
                        parts.push(address.borough || address.suburb || address.district || address.town);
                    }
                } else {
                    // For other countries
                    if (address.city || address.town || address.village) {
                        parts.push(address.city || address.town || address.village);
                    }
                    parts.push(address.country);
                }
            }

            location = parts.length > 0 ? parts.join(', ') : null;
        }

        // Cache the result
        geocodeCache.set(cacheKey, location);

        return location;
    } catch (error) {
        console.warn('Reverse geocoding error:', error);
        return null;
    }
}

/**
 * Batch reverse geocode with rate limiting
 * Nominatim allows max 1 request per second
 * @param {Array<{latitude: number, longitude: number}>} coordinates
 * @returns {Promise<Array<string|null>>}
 */
export async function batchReverseGeocode(coordinates) {
    const results = [];

    for (let i = 0; i < coordinates.length; i++) {
        const { latitude, longitude } = coordinates[i];
        const location = await reverseGeocode(latitude, longitude);
        results.push(location);

        // Rate limiting: wait 1 second between requests (skip if cached)
        const roundedLat = Math.round(latitude * 100) / 100;
        const roundedLon = Math.round(longitude * 100) / 100;
        const wasCached = geocodeCache.has(`${roundedLat},${roundedLon}`);

        if (i < coordinates.length - 1 && !wasCached) {
            await new Promise(resolve => setTimeout(resolve, 1100));
        }
    }

    return results;
}

/**
 * Parse EXIF data from DataView
 */
function parseExif(view) {
    const result = { date: null, location: null, latitude: null, longitude: null };

    try {
        // Check for JPEG
        if (view.getUint16(0) !== 0xFFD8) {
            return result;
        }

        let offset = 2;
        const length = view.byteLength;

        while (offset < length) {
            if (view.getUint8(offset) !== 0xFF) {
                offset++;
                continue;
            }

            const marker = view.getUint8(offset + 1);

            // APP1 marker (EXIF)
            if (marker === 0xE1) {
                const exifData = parseExifSegment(view, offset + 4);
                Object.assign(result, exifData);
                break;
            }

            // Skip other markers
            if (marker === 0xD8 || marker === 0xD9) {
                offset += 2;
            } else {
                const segmentLength = view.getUint16(offset + 2);
                offset += 2 + segmentLength;
            }
        }
    } catch (e) {
        console.warn('EXIF parsing error:', e);
    }

    return result;
}

/**
 * Parse EXIF APP1 segment
 */
function parseExifSegment(view, offset) {
    const result = { date: null, location: null, latitude: null, longitude: null };

    // Check "Exif\0\0"
    const exifHeader = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
    );

    if (exifHeader !== 'Exif') {
        return result;
    }

    const tiffOffset = offset + 6;
    const littleEndian = view.getUint16(tiffOffset) === 0x4949;

    const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);

    // Parse IFD0
    const ifd0Data = parseIFD(view, tiffOffset, tiffOffset + ifdOffset, littleEndian);

    // Get DateTimeOriginal from EXIF IFD
    if (ifd0Data.exifIFDPointer) {
        const exifData = parseIFD(view, tiffOffset, tiffOffset + ifd0Data.exifIFDPointer, littleEndian);
        if (exifData.dateTimeOriginal) {
            result.date = formatExifDate(exifData.dateTimeOriginal);
        } else if (exifData.dateTime) {
            result.date = formatExifDate(exifData.dateTime);
        }
    }

    // Fallback to IFD0 DateTime
    if (!result.date && ifd0Data.dateTime) {
        result.date = formatExifDate(ifd0Data.dateTime);
    }

    // Get GPS data (location will be filled by reverse geocoding later)
    if (ifd0Data.gpsIFDPointer) {
        const gpsData = parseGPSIFD(view, tiffOffset, tiffOffset + ifd0Data.gpsIFDPointer, littleEndian);
        if (gpsData.latitude !== null && gpsData.longitude !== null) {
            result.latitude = gpsData.latitude;
            result.longitude = gpsData.longitude;
            // location is null - will be resolved via reverseGeocode()
        }
    }

    return result;
}

/**
 * Parse IFD (Image File Directory)
 */
function parseIFD(view, tiffOffset, ifdOffset, littleEndian) {
    const result = {};

    try {
        const entries = view.getUint16(ifdOffset, littleEndian);

        for (let i = 0; i < entries; i++) {
            const entryOffset = ifdOffset + 2 + (i * 12);
            const tag = view.getUint16(entryOffset, littleEndian);
            const type = view.getUint16(entryOffset + 2, littleEndian);
            const count = view.getUint32(entryOffset + 4, littleEndian);

            // EXIF IFD Pointer (0x8769)
            if (tag === 0x8769) {
                result.exifIFDPointer = view.getUint32(entryOffset + 8, littleEndian);
            }
            // GPS IFD Pointer (0x8825)
            else if (tag === 0x8825) {
                result.gpsIFDPointer = view.getUint32(entryOffset + 8, littleEndian);
            }
            // DateTime (0x0132)
            else if (tag === 0x0132) {
                result.dateTime = readString(view, tiffOffset, entryOffset + 8, count, littleEndian);
            }
            // DateTimeOriginal (0x9003)
            else if (tag === 0x9003) {
                result.dateTimeOriginal = readString(view, tiffOffset, entryOffset + 8, count, littleEndian);
            }
        }
    } catch (e) {
        console.warn('IFD parsing error:', e);
    }

    return result;
}

/**
 * Parse GPS IFD
 */
function parseGPSIFD(view, tiffOffset, ifdOffset, littleEndian) {
    const result = { latitude: null, longitude: null };
    let latRef = 'N', lonRef = 'E';
    let latValues = null, lonValues = null;

    try {
        const entries = view.getUint16(ifdOffset, littleEndian);

        for (let i = 0; i < entries; i++) {
            const entryOffset = ifdOffset + 2 + (i * 12);
            const tag = view.getUint16(entryOffset, littleEndian);
            const count = view.getUint32(entryOffset + 4, littleEndian);

            // GPSLatitudeRef (0x0001)
            if (tag === 0x0001) {
                latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
            }
            // GPSLatitude (0x0002)
            else if (tag === 0x0002) {
                const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
                latValues = readRationals(view, tiffOffset + valueOffset, 3, littleEndian);
            }
            // GPSLongitudeRef (0x0003)
            else if (tag === 0x0003) {
                lonRef = String.fromCharCode(view.getUint8(entryOffset + 8));
            }
            // GPSLongitude (0x0004)
            else if (tag === 0x0004) {
                const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
                lonValues = readRationals(view, tiffOffset + valueOffset, 3, littleEndian);
            }
        }

        if (latValues && lonValues) {
            result.latitude = dmsToDecimal(latValues, latRef);
            result.longitude = dmsToDecimal(lonValues, lonRef);
        }
    } catch (e) {
        console.warn('GPS IFD parsing error:', e);
    }

    return result;
}

/**
 * Read string from EXIF
 */
function readString(view, tiffOffset, valueOffset, count, littleEndian) {
    let str = '';
    const actualOffset = count > 4
        ? tiffOffset + view.getUint32(valueOffset, littleEndian)
        : valueOffset;

    for (let i = 0; i < count - 1; i++) {
        const char = view.getUint8(actualOffset + i);
        if (char === 0) break;
        str += String.fromCharCode(char);
    }

    return str;
}

/**
 * Read rational values (for GPS coordinates)
 */
function readRationals(view, offset, count, littleEndian) {
    const values = [];
    for (let i = 0; i < count; i++) {
        const numerator = view.getUint32(offset + (i * 8), littleEndian);
        const denominator = view.getUint32(offset + (i * 8) + 4, littleEndian);
        values.push(denominator ? numerator / denominator : 0);
    }
    return values;
}

/**
 * Convert DMS (degrees, minutes, seconds) to decimal degrees
 */
function dmsToDecimal(dms, ref) {
    const [degrees, minutes, seconds] = dms;
    let decimal = degrees + (minutes / 60) + (seconds / 3600);

    if (ref === 'S' || ref === 'W') {
        decimal = -decimal;
    }

    return decimal;
}

/**
 * Format EXIF date string to ISO format
 * EXIF format: "YYYY:MM:DD HH:MM:SS"
 * Output: "YYYY-MM-DDTHH:MM:SS"
 */
function formatExifDate(exifDate) {
    if (!exifDate) return null;

    // Replace first two colons with dashes
    const parts = exifDate.split(' ');
    if (parts.length >= 1) {
        parts[0] = parts[0].replace(/:/g, '-');
    }

    return parts.join('T');
}

/**
 * Get file's last modified date as fallback
 * @param {File} file
 * @returns {string} ISO date string
 */
export function getFileDate(file) {
    return new Date(file.lastModified).toISOString();
}
