/**
 * StorageService Usage Examples
 *
 * This file demonstrates how to use the StorageService for uploading files
 * to Yandex Object Storage from base64 encoded strings.
 */


import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename).replace("\\Tests", "");

// Load .env from project root (same directory as this file)
const result = dotenv.config({ path: join(__dirname, '.env') });

// Debug: check if .env was loaded
if (result.error) {
    console.error('Error loading .env:', result.error);
} else {
    console.log('.env loaded successfully');
}

// Debug: check if Yandex variables are present
console.log('Environment variables check:');
console.log('YANDEX_ACCESS_KEY_ID:', process.env.YANDEX_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
console.log('YANDEX_SECRET_ACCESS_KEY:', process.env.YANDEX_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
console.log('YANDEX_BUCKET_NAME:', process.env.YANDEX_BUCKET_NAME ? 'SET' : 'NOT SET');
console.log('---');

import storageService from '../Core/Services/storageService.js';


// ============================================
// Example 1: Upload a single image from base64
// ============================================
async function uploadImageExample() {
    try {
        // Base64 string can come from:
        // - Frontend form input (file reader)
        // - Database (stored base64)
        // - External API response
        const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const result = await storageService.uploadFile(
            base64Image,
            null,     // Optional: custom filename
            'image/png',              // MIME type
            'files'                // Optional: folder in bucket
        );

        console.log('File uploaded successfully!');
        console.log('Public URL:', result.url);
        console.log('Object Key:', result.key);

        // result = {
        //   url: 'https://your-bucket.storage.yandexcloud.net/products/product-image.png',
        //   key: 'products/product-image.png'
        // }

        return result;
    } catch (error) {
        console.error('Upload failed:', error.message);
        throw error;
    }
}

// ============================================
// Example 2: Upload with auto-generated filename
// ============================================
async function uploadWithAutoName() {
    try {
        const base64Data = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcU...';

        // fileName is null, so UUID will be generated
        const result = await storageService.uploadFile(
            base64Data,       // Data URL format is also supported
            null,             // null = auto-generate UUID filename
            'image/jpeg',
            'avatars'
        );

        console.log('Uploaded to:', result.url);
        // URL: https://your-bucket.storage.yandexcloud.net/avatars/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg

        return result;
    } catch (error) {
        console.error('Upload failed:', error.message);
    }
}

// ============================================
// Example 3: Upload multiple files at once
// ============================================
async function uploadMultipleFilesExample() {
    try {
        const files = [
            {
                base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAY...',
                fileName: 'thumbnail-1.png',
                contentType: 'image/png'
            },
            {
                base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
                fileName: 'thumbnail-2.jpg',
                contentType: 'image/jpeg'
            },
            {
                base64: 'JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG...',
                contentType: 'application/pdf'
                // fileName omitted = auto-generated
            }
        ];

        const results = await storageService.uploadMultipleFiles(files, 'product-gallery');

        console.log(`Successfully uploaded ${results.length} files`);
        results.forEach((result, index) => {
            console.log(`File ${index + 1}:`, result.url);
        });

        return results;
    } catch (error) {
        console.error('Multiple upload failed:', error.message);
    }
}

// ============================================
// Example 4: Validate base64 before upload
// ============================================
async function validateAndUploadExample(base64String) {
    try {
        // Validate base64 string first
        if (!storageService.isValidBase64(base64String)) {
            throw new Error('Invalid base64 string');
        }

        const result = await storageService.uploadFile(
            base64String,
            'validated-file.png',
            'image/png'
        );

        return result;
    } catch (error) {
        console.error('Validation or upload failed:', error.message);
    }
}

// ============================================
// Example 5: Usage in Express controller
// ============================================
class ProductController {
    async uploadProductImage(req, res) {
        try {
            const { base64Image, fileName } = req.body;

            // Validate input
            if (!base64Image) {
                return res.status(400).json({
                    success: false,
                    error: 'base64Image is required'
                });
            }

            // Validate base64
            if (!storageService.isValidBase64(base64Image)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid base64 string'
                });
            }

            // Upload to Yandex Cloud
            const result = await storageService.uploadFile(
                base64Image,
                fileName || null,
                'image/jpeg',
                'products'
            );

            // Save URL to database
            // await ProductModel.updateImage(productId, result.url);

            return res.status(200).json({
                success: true,
                data: {
                    imageUrl: result.url,
                    objectKey: result.key
                }
            });

        } catch (error) {
            console.error('Error uploading product image:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload image'
            });
        }
    }

    async uploadMultipleProductImages(req, res) {
        try {
            const { images } = req.body; // Array of {base64, fileName?, contentType}

            if (!Array.isArray(images) || images.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'images array is required'
                });
            }

            // Upload all images
            const results = await storageService.uploadMultipleFiles(
                images,
                'products'
            );

            return res.status(200).json({
                success: true,
                data: {
                    images: results
                }
            });

        } catch (error) {
            console.error('Error uploading multiple images:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload images'
            });
        }
    }
}

// ============================================
// Example 6: Supported file types
// ============================================
const supportedMimeTypes = {
    images: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
    ],
    documents: [
        'application/pdf',
        'text/plain',
        'application/json'
    ],
    archives: [
        'application/zip'
    ],
    video: [
        'video/mp4',
        'video/mpeg'
    ],
    audio: [
        'audio/mpeg',
        'audio/wav'
    ]
};

// ============================================
// Example 7: Delete a file from cloud storage
// ============================================
async function deleteFileExample() {
    try {
        console.log('\n=== Delete File Test ===');

        // Specify the object key (file path in bucket)
        const fileKey = 'files/1d200940-9201-4380-903b-d83f4a32e086.png';

        console.log('Deleting file with key:', fileKey);
        const result = await storageService.deleteFile(fileKey);

        console.log('File deleted successfully!');
        console.log('Success:', result.success);
        console.log('Deleted key:', result.key);

        return result;
    } catch (error) {
        console.error('Delete failed:', error.message);
        throw error;
    }
}

await uploadImageExample();
await deleteFileExample();
