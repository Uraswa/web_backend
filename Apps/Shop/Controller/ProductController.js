import ProductModel from "../Model/ProductModel.js";
import CategoryModel from "../Model/CategoryModel.js";
import storageService from "../../../Core/Services/storageService.js";

class ProductController {
    /**
     * Проверяет, является ли URL ссылкой на Yandex Cloud Storage
     * @param {string} url - URL для проверки
     * @returns {boolean}
     */
    _isYandexCloudUrl(url) {
        return url.includes('storage.yandexcloud.net');
    }

    /**
     * Скачивает изображение по URL и конвертирует в base64
     * @param {string} url - URL изображения
     * @returns {Promise<{base64: string, contentType: string}>}
     */
    async _downloadImageAsBase64(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');

            return { base64, contentType };
        } catch (error) {
            console.error(`Error downloading image from ${url}:`, error);
            throw error;
        }
    }

    /**
     * Обрабатывает массив фотографий: проверяет и загружает в Yandex Cloud
     * @param {string|Array<string>} photos - Массив URL фотографий или JSON строка
     * @returns {Promise<string>} - JSON строка с обновленными URL
     */
    async _processPhotos(photos) {
        if (!photos) return '[]';

        // Парсим фотографии если они переданы как строка
        let photosArray = typeof photos === 'string' ? JSON.parse(photos) : photos;

        if (!Array.isArray(photosArray)) {
            photosArray = [];
        }

        const processedPhotos = [];

        for (const photoUrl of photosArray) {
            // Пропускаем пустые значения
            if (!photoUrl || typeof photoUrl !== 'string') {
                continue;
            }

            // Если уже на Yandex Cloud, оставляем как есть
            if (this._isYandexCloudUrl(photoUrl)) {
                processedPhotos.push(photoUrl);
                continue;
            }

            try {
                // Скачиваем изображение и конвертируем в base64
                const { base64, contentType } = await this._downloadImageAsBase64(photoUrl);

                // Загружаем в Yandex Cloud
                const result = await storageService.uploadFile(base64, null, contentType, 'products');
                processedPhotos.push(result.url);
            } catch (error) {
                console.error(`Failed to process photo ${photoUrl}:`, error);
                // Можно либо пропустить фото, либо оставить оригинальный URL
                // Здесь я пропущу фото, которое не удалось обработать
            }
        }

        return JSON.stringify(processedPhotos);
    }

    /**
     * Валидирует и обрабатывает характеристики товара
     * @param {Object|string} characteristics - Характеристики товара в формате {characteristic_id: value, custom_char_name: value}
     * @param {number} categoryId - ID категории товара
     * @returns {Promise<Object>} - Валидированные характеристики
     */
    async _validateAndProcessCharacteristics(characteristics, categoryId) {
        if (!characteristics) {
            return {};
        }

        // Парсим характеристики если они переданы как строка
        let charsObj = typeof characteristics === 'string' ? JSON.parse(characteristics) : characteristics;

        if (typeof charsObj !== 'object' || Array.isArray(charsObj)) {
            throw new Error('Характеристики должны быть объектом');
        }

        // Получаем список характеристик категории
        const categoryCharacteristics = await CategoryModel.getCharacteristics(categoryId);

        // Создаем Map для быстрого поиска характеристик по ID
        const charMap = new Map();
        categoryCharacteristics.forEach(char => {
            charMap.set(String(char.characteristic_id), char);
        });

        const validatedChars = {};

        // Валидируем каждую характеристику
        for (const [key, value] of Object.entries(charsObj)) {
            // Если это кастомная характеристика, оставляем как есть
            if (key.startsWith('custom_char_')) {
                validatedChars[key] = value;
                continue;
            }

            // Проверяем, что это существующая характеристика категории
            const categoryChar = charMap.get(key);
            if (!categoryChar) {
                throw new Error(`Характеристика с ID ${key} не существует в категории`);
            }

            // Валидируем значение в зависимости от типа
            switch (categoryChar.type) {
                case 'int':
                    const intValue = parseInt(value);
                    if (isNaN(intValue)) {
                        throw new Error(`Характеристика "${categoryChar.name}" должна быть целым числом`);
                    }
                    // Проверяем диапазон если он задан
                    if (categoryChar.data?.min_value !== undefined && intValue < categoryChar.data.min_value) {
                        throw new Error(`Характеристика "${categoryChar.name}" должна быть >= ${categoryChar.data.min_value}`);
                    }
                    if (categoryChar.data?.max_value !== undefined && intValue > categoryChar.data.max_value) {
                        throw new Error(`Характеристика "${categoryChar.name}" должна быть <= ${categoryChar.data.max_value}`);
                    }
                    validatedChars[key] = intValue;
                    break;

                case 'float':
                    const floatValue = parseFloat(value);
                    if (isNaN(floatValue)) {
                        throw new Error(`Характеристика "${categoryChar.name}" должна быть числом`);
                    }
                    // Проверяем диапазон если он задан
                    if (categoryChar.data?.min_value !== undefined && floatValue < categoryChar.data.min_value) {
                        throw new Error(`Характеристика "${categoryChar.name}" должна быть >= ${categoryChar.data.min_value}`);
                    }
                    if (categoryChar.data?.max_value !== undefined && floatValue > categoryChar.data.max_value) {
                        throw new Error(`Характеристика "${categoryChar.name}" должна быть <= ${categoryChar.data.max_value}`);
                    }
                    validatedChars[key] = floatValue;
                    break;

                case 'bool':
                    // Преобразуем в boolean
                    validatedChars[key] = Boolean(value);
                    break;

                case 'color':
                case 'options':
                    // Для color и options просто сохраняем строковое значение
                    validatedChars[key] = String(value);
                    break;

                default:
                    // Неизвестный тип - сохраняем как есть
                    validatedChars[key] = value;
            }
        }

        return validatedChars;
    }

    // Список товаров с фильтром по названию
    async getListProductByFilter(req, res) {
        try {
            const ownerId = Number.parseInt(req.user?.user_id, 10);
            if (!Number.isFinite(ownerId)) {
                return res.status(401).json({ success: false, error: 'unauthorized' });
            }

            const searchTerm = req.query.search || '';
            const limit = Number.parseInt(req.query.limit, 10) || 20;
            const products = await ProductModel.getProductListByOwnerId(ownerId, searchTerm, limit);
            res.json({ success: true, data: products });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: 'Ошибка получения списка товаров' });
        }
    }

    // Получить товар для редактирования
    async get(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const product = await ProductModel.getById(productId);
            if (!product) return res.status(404).json({ success: false, error: 'Товар не найден' });
            res.json({ success: true, data: product });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: 'Ошибка получения товара' });
        }
    }

    // Добавление нового товара или товара в группу вариантов
    async create(req, res) {
        try {
            const data = req.body;

            // Проверяем наличие обязательного поля categoryId
            if (!data.categoryId) {
                return res.status(400).json({
                    success: false,
                    error: 'Поле categoryId обязательно'
                });
            }

            // Валидируем и обрабатываем характеристики
            if (data.characteristics) {
                data.characteristics = await this._validateAndProcessCharacteristics(
                    data.characteristics,
                    data.categoryId
                );
            }

            // Обрабатываем фотографии перед сохранением
            if (data.photos) {
                data.photos = await this._processPhotos(data.photos);
            }

            // data может содержать variantGroupId и characteristics
            const newProduct = await ProductModel.addProduct(data);
            res.status(201).json({ success: true, data: newProduct });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: err.message || 'Ошибка создания товара' });
        }
    }

    // Обновление товара (с проверкой уникальности комбинации характеристик в группе)
    async update(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const data = req.body; // data содержит характеристики и опционально variantGroupId

            // Получаем текущий товар для определения categoryId если он не передан
            const currentProduct = await ProductModel.getById(productId);
            if (!currentProduct) {
                return res.status(404).json({
                    success: false,
                    error: 'Товар не найден'
                });
            }

            // Определяем categoryId - либо из запроса, либо из текущего товара
            const categoryId = data.categoryId || currentProduct.category_id;

            // Валидируем и обрабатываем характеристики
            if (data.characteristics) {
                data.characteristics = await this._validateAndProcessCharacteristics(
                    data.characteristics,
                    categoryId
                );
            }

            // Обрабатываем фотографии перед сохранением
            if (data.photos) {
                data.photos = await this._processPhotos(data.photos);
            }

            const updatedProduct = await ProductModel.updateProduct(productId, data);
            res.json({ success: true, data: updatedProduct });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: err.message || 'Ошибка обновления товара' });
        }
    }

    // Удаление товара
    async delete(req, res) {
        try {
            const productId = parseInt(req.params.id);
            const success = await ProductModel.delete(productId);
            if (!success) return res.status(404).json({ success: false, error: 'Товар не найден' });
            res.json({ success: true, message: 'Товар удалён' });
        } catch (err) {
            console.error(err);
            if (err?.code === '23503') {
                return res.status(409).json({
                    success: false,
                    error: 'Нельзя удалить товар: он используется в заказах'
                });
            }
            res.status(500).json({ success: false, error: 'Ошибка удаления товара' });
        }
    }
}

export default new ProductController();
