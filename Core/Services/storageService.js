import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';

class StorageService {
    constructor() {
        this.s3Client = null;
    }

    /**
     * Lazy initialization of S3 client
     */
    configureClient() {
        if (!this.s3Client) {
            this.s3Client = new S3Client({
                region: process.env.YANDEX_REGION || 'ru-central1',
                endpoint: process.env.YANDEX_ENDPOINT || 'https://storage.yandexcloud.net',
                credentials: {
                    accessKeyId: process.env.YANDEX_ACCESS_KEY_ID,
                    secretAccessKey: process.env.YANDEX_SECRET_ACCESS_KEY,
                },
            });
        }
    }

    /**
     * Upload a file to Yandex Object Storage from base64 string
     * @param {string} base64String - Base64 encoded file content
     * @param {string} fileName - Original file name (optional, will generate UUID if not provided)
     * @param {string} contentType - MIME type of the file (e.g., 'image/jpeg', 'application/pdf')
     * @param {string} folder - Folder path in bucket (optional, e.g., 'products', 'avatars')
     * @returns {Promise<{url: string, key: string}>} - Public URL and object key
     */
    async uploadFile(base64String, fileName = null, contentType = 'application/octet-stream', folder = '') {
        try {
            if (!this.s3Client) {
                this.configureClient();
            }

            // Remove data URL prefix if present (e.g., "data:image/png;base64,")
            const base64Data = base64String.replace(/^data:[^;]+;base64,/, '');

            // Convert base64 to Buffer
            const fileBuffer = Buffer.from(base64Data, 'base64');

            // Generate unique file name if not provided
            const fileExtension = this._getExtensionFromMimeType(contentType);
            const uniqueFileName = fileName || `${uuidv4()}${fileExtension}`;

            // Construct object key with folder if provided
            const objectKey = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

            // Create upload command
            const command = new PutObjectCommand({
                Bucket: process.env.YANDEX_BUCKET_NAME,
                Key: objectKey,
                Body: fileBuffer,
                ContentType: contentType,
            });

            // Upload file
            await this.s3Client.send(command);

            // Construct public URL
            const bucketName = process.env.YANDEX_BUCKET_NAME;
            const publicUrl = `https://${bucketName}.storage.yandexcloud.net/${objectKey}`;

            return {
                url: publicUrl,
                key: objectKey
            };

        } catch (error) {
            console.error('Error uploading file to Yandex Object Storage:', error);
            throw new Error(`File upload failed: ${error.message}`);
        }
    }

    /**
     * Upload multiple files from base64 strings
     * @param {Array<{base64: string, fileName?: string, contentType: string}>} files - Array of file objects
     * @param {string} folder - Folder path in bucket (optional)
     * @returns {Promise<Array<{url: string, key: string}>>} - Array of upload results
     */
    async uploadMultipleFiles(files, folder = '') {
        try {
            const uploadPromises = files.map(file =>
                this.uploadFile(file.base64, file.fileName, file.contentType, folder)
            );

            return await Promise.all(uploadPromises);
        } catch (error) {
            console.error('Error uploading multiple files:', error);
            throw new Error(`Multiple files upload failed: ${error.message}`);
        }
    }

    /**
     * Get file extension from MIME type
     * @param {string} mimeType - MIME type
     * @returns {string} - File extension with dot (e.g., '.jpg')
     * @private
     */
    _getExtensionFromMimeType(mimeType) {
        const mimeToExt = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'application/pdf': '.pdf',
            'text/plain': '.txt',
            'application/json': '.json',
            'application/zip': '.zip',
            'video/mp4': '.mp4',
            'video/mpeg': '.mpeg',
            'audio/mpeg': '.mp3',
            'audio/wav': '.wav',
        };

        return mimeToExt[mimeType] || '';
    }

    /**
     * Validate base64 string
     * @param {string} base64String - Base64 string to validate
     * @returns {boolean} - True if valid
     */
    isValidBase64(base64String) {
        try {
            // Remove data URL prefix if present
            const base64Data = base64String.replace(/^data:[^;]+;base64,/, '');

            // Check if it's valid base64
            const buffer = Buffer.from(base64Data, 'base64');
            return buffer.toString('base64') === base64Data;
        } catch (error) {
            return false;
        }
    }

    /**
     * Delete a file from Yandex Object Storage
     * @param {string} key - Object key (file path in bucket, e.g., 'products/image.jpg')
     * @returns {Promise<{success: boolean, key: string}>} - Deletion result
     */
    async deleteFile(key) {
        try {
            if (!this.s3Client) {
                this.configureClient();
            }

            // Create delete command
            const command = new DeleteObjectCommand({
                Bucket: process.env.YANDEX_BUCKET_NAME,
                Key: key,
            });

            // Delete file
            await this.s3Client.send(command);

            return {
                success: true,
                key: key
            };

        } catch (error) {
            console.error('Error deleting file from Yandex Object Storage:', error);
            throw new Error(`File deletion failed: ${error.message}`);
        }
    }
}

export default new StorageService();