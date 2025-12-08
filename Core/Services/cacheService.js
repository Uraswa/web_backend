class CacheService {

    _cache = {}; // Хранилище кэша в памяти
    _defaultTTL = 3600; // Время жизни по умолчанию: 1 час в секундах
    _cleanupInterval = 5 * 60 * 1000; // Интервал очистки: 5 минут

    constructor() {
        // Запускаем периодическую очистку просроченных записей
        setInterval(() => {
            this._cleanupExpired();
        }, this._cleanupInterval);
    }

    /**
     * Получить значение по ключу
     * @param {string} key - Ключ кэша
     * @returns {Promise<any>} - Значение или null
     */
    async get(key) {
        try {
            const cacheEntry = this._cache[key];

            if (!cacheEntry) {
                return null;
            }

            // Проверяем, не истек ли срок жизни
            if (this._isExpired(cacheEntry)) {
                // Автоматически удаляем просроченную запись
                delete this._cache[key];
                return null;
            }

            return cacheEntry.value;
        } catch (error) {
            console.error('Ошибка в get:', error);
            return null;
        }
    }

    /**
     * Сохранить значение в кэш
     * @param {string} key - Ключ кэша
     * @param {any} value - Значение для сохранения
     * @param {number} ttl - Время жизни в секундах (по умолчанию 1 час)
     * @returns {Promise<boolean>} - Успешно ли сохранено
     */
    async set(key, value, ttl = this._defaultTTL) {
        try {
            const expiresAt = Date.now() + (ttl * 1000);

            this._cache[key] = {
                value,
                expiresAt,
                createdAt: Date.now(),
                ttl
            };

            return true;
        } catch (error) {
            console.error('Ошибка в set:', error);
            return false;
        }
    }

    /**
     * Удалить значение по ключу
     * @param {string} key - Ключ кэша
     * @returns {Promise<boolean>} - Успешно ли удалено
     */
    async del(key) {
        try {
            const existed = key in this._cache;
            delete this._cache[key];
            return existed;
        } catch (error) {
            console.error('Ошибка в del:', error);
            return false;
        }
    }

    /**
     * Проверить существование ключа
     * @param {string} key - Ключ кэша
     * @returns {Promise<boolean>} - Существует ли ключ
     */
    async exists(key) {
        try {
            const cacheEntry = this._cache[key];

            if (!cacheEntry) {
                return false;
            }

            if (this._isExpired(cacheEntry)) {
                await this.del(key);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Ошибка в exists:', error);
            return false;
        }
    }

    /**
     * Установить время жизни ключа
     * @param {string} key - Ключ кэша
     * @param {number} ttl - Время жизни в секундах
     * @returns {Promise<boolean>} - Успешно ли установлено
     */
    async expire(key, ttl) {
        try {
            const cacheEntry = this._cache[key];

            if (!cacheEntry) {
                return false;
            }

            if (this._isExpired(cacheEntry)) {
                await this.del(key);
                return false;
            }

            cacheEntry.expiresAt = Date.now() + (ttl * 1000);
            cacheEntry.ttl = ttl;

            return true;
        } catch (error) {
            console.error('Ошибка в expire:', error);
            return false;
        }
    }

    /**
     * Получить оставшееся время жизни ключа
     * @param {string} key - Ключ кэша
     * @returns {Promise<number>} - Оставшееся время в секундах (-1 если бессрочно, -2 если не существует)
     */
    async ttl(key) {
        try {
            const cacheEntry = this._cache[key];

            if (!cacheEntry) {
                return -2; // Ключ не существует
            }

            if (this._isExpired(cacheEntry)) {
                await this.del(key);
                return -2; // Ключ истек и удален
            }

            const remainingTime = Math.floor((cacheEntry.expiresAt - Date.now()) / 1000);
            return remainingTime > 0 ? remainingTime : 0;
        } catch (error) {
            console.error('Ошибка в ttl:', error);
            return -2;
        }
    }

    /**
     * Увеличить числовое значение на указанное число
     * @param {string} key - Ключ кэша
     * @param {number} increment - На сколько увеличить (по умолчанию 1)
     * @returns {Promise<number>} - Новое значение или null при ошибке
     */
    async incr(key, increment = 1) {
        try {
            const currentValue = await this.get(key);

            let newValue;
            if (currentValue === null) {
                newValue = increment;
            } else if (typeof currentValue === 'number') {
                newValue = currentValue + increment;
            } else {
                throw new Error('Значение не является числом');
            }

            await this.set(key, newValue);
            return newValue;
        } catch (error) {
            console.error('Ошибка в incr:', error);
            return null;
        }
    }

    /**
     * Уменьшить числовое значение на указанное число
     * @param {string} key - Ключ кэша
     * @param {number} decrement - На сколько уменьшить (по умолчанию 1)
     * @returns {Promise<number>} - Новое значение или null при ошибке
     */
    async decr(key, decrement = 1) {
        try {
            return await this.incr(key, -decrement);
        } catch (error) {
            console.error('Ошибка в decr:', error);
            return null;
        }
    }

    /**
     * Получить несколько значений по ключам
     * @param {string[]} keys - Массив ключей
     * @returns {Promise<Object>} - Объект с значениями
     */
    async mget(keys) {
        try {
            const result = {};

            for (const key of keys) {
                result[key] = await this.get(key);
            }

            return result;
        } catch (error) {
            console.error('Ошибка в mget:', error);
            return {};
        }
    }

    /**
     * Установить несколько значений
     * @param {Object} keyValues - Объект ключ-значение
     * @param {number} ttl - Время жизни в секундах
     * @returns {Promise<boolean>} - Успешно ли сохранены все значения
     */
    async mset(keyValues, ttl = this._defaultTTL) {
        try {
            let allSuccess = true;

            for (const [key, value] of Object.entries(keyValues)) {
                const success = await this.set(key, value, ttl);
                if (!success) {
                    allSuccess = false;
                }
            }

            return allSuccess;
        } catch (error) {
            console.error('Ошибка в mset:', error);
            return false;
        }
    }

    /**
     * Поиск ключей по паттерну
     * @param {string} pattern - Паттерн для поиска (поддерживает * в конце)
     * @returns {Promise<string[]>} - Массив найденных ключей
     */
    async keys(pattern) {
        try {
            const allKeys = Object.keys(this._cache);

            if (pattern === '*') {
                return allKeys;
            }

            if (pattern.endsWith('*')) {
                const prefix = pattern.slice(0, -1);
                return allKeys.filter(key => key.startsWith(prefix));
            }

            // Простое совпадение
            return allKeys.filter(key => key === pattern);
        } catch (error) {
            console.error('Ошибка в keys:', error);
            return [];
        }
    }

    /**
     * Очистить весь кэш
     * @returns {Promise<boolean>} - Успешно ли очищено
     */
    async flushAll() {
        try {
            this._cache = {};
            return true;
        } catch (error) {
            console.error('Ошибка в flushAll:', error);
            return false;
        }
    }

    /**
     * Получить статистику кэша
     * @returns {Promise<Object>} - Статистика кэша
     */
    async getStats() {
        try {
            const totalKeys = Object.keys(this._cache).length;
            let expiredKeys = 0;
            let totalSize = 0;

            // Подсчитываем примерный размер и истекшие ключи
            for (const [key, entry] of Object.entries(this._cache)) {
                try {
                    totalSize += JSON.stringify(entry).length;

                    if (this._isExpired(entry)) {
                        expiredKeys++;
                    }
                } catch (e) {
                    // Пропускаем записи, которые нельзя сериализовать
                    totalSize += 100; // Примерный размер
                }
            }

            return {
                total_keys: totalKeys,
                expired_keys: expiredKeys,
                active_keys: totalKeys - expiredKeys,
                estimated_size_kb: Math.ceil(totalSize / 1024),
                cleanup_interval_ms: this._cleanupInterval,
                default_ttl_seconds: this._defaultTTL
            };
        } catch (error) {
            console.error('Ошибка в getStats:', error);
            return {
                total_keys: 0,
                expired_keys: 0,
                active_keys: 0,
                estimated_size_kb: 0,
                cleanup_interval_ms: this._cleanupInterval,
                default_ttl_seconds: this._defaultTTL
            };
        }
    }

    /**
     * Хелперы для кэширования данных
     */

    /**
     * Кэшировать результат функции
     * @param {string} key - Ключ кэша
     * @param {Function} fn - Функция, результат которой нужно кэшировать
     * @param {number} ttl - Время жизни в секундах
     * @returns {Promise<any>} - Результат функции (из кэша или новый)
     */
    async memoize(key, fn, ttl = this._defaultTTL) {
        try {
            const cached = await this.get(key);

            if (cached !== null) {
                return cached;
            }

            const result = await fn();
            await this.set(key, result, ttl);

            return result;
        } catch (error) {
            console.error('Ошибка в memoize:', error);
            // Если кэширование не удалось, просто выполняем функцию
            return await fn();
        }
    }

    /**
     * Кэшировать результат функции с обработкой ошибок
     * @param {string} key - Ключ кэша
     * @param {Function} fn - Функция, результат которой нужно кэшировать
     * @param {number} ttl - Время жизни в секундах
     * @param {any} fallbackValue - Значение по умолчанию при ошибке
     * @returns {Promise<any>} - Результат функции или fallbackValue
     */
    async memoizeSafe(key, fn, ttl = this._defaultTTL, fallbackValue = null) {
        try {
            return await this.memoize(key, fn, ttl);
        } catch (error) {
            console.error('Ошибка в memoizeSafe:', error);

            // Пробуем получить из кэша даже если функция упала
            try {
                const cached = await this.get(key);
                if (cached !== null) {
                    return cached;
                }
            } catch (cacheError) {
                console.error('Не удалось получить из кэша:', cacheError);
            }

            return fallbackValue;
        }
    }

    /**
     * Очистить кэш по префиксу
     * @param {string} prefix - Префикс для удаления
     * @returns {Promise<number>} - Количество удаленных ключей
     */
    async clearByPrefix(prefix) {
        try {
            const keysToDelete = await this.keys(`${prefix}*`);
            let deletedCount = 0;

            for (const key of keysToDelete) {
                const deleted = await this.del(key);
                if (deleted) {
                    deletedCount++;
                }
            }

            return deletedCount;
        } catch (error) {
            console.error('Ошибка в clearByPrefix:', error);
            return 0;
        }
    }

    /**
     * Вспомогательные методы
     */

    /**
     * Проверить, истек ли срок жизни записи
     * @param {Object} cacheEntry - Запись кэша
     * @returns {boolean} - Истек ли срок
     */
    _isExpired(cacheEntry) {
        return Date.now() > cacheEntry.expiresAt;
    }

    /**
     * Очистка просроченных записей
     */
    _cleanupExpired() {
        try {
            const now = Date.now();
            let deletedCount = 0;

            for (const [key, entry] of Object.entries(this._cache)) {
                if (now > entry.expiresAt) {
                    delete this._cache[key];
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`Очистка кэша: удалено ${deletedCount} просроченных записей`);
            }
        } catch (error) {
            console.error('Ошибка при очистке просроченных записей:', error);
        }
    }

    /**
     * Методы для отладки
     */

    /**
     * Получить все записи кэша (для отладки)
     * @returns {Object} - Все записи кэша
     */
    _getAllCache() {
        return this._cache;
    }

    /**
     * Получить информацию о записи (для отладки)
     * @param {string} key - Ключ кэша
     * @returns {Object} - Информация о записи
     */
    _getEntryInfo(key) {
        const entry = this._cache[key];
        if (!entry) return null;

        return {
            key,
            value: entry.value,
            expiresAt: new Date(entry.expiresAt).toISOString(),
            createdAt: new Date(entry.createdAt).toISOString(),
            ttl: entry.ttl,
            remainingSeconds: Math.floor((entry.expiresAt - Date.now()) / 1000)
        };
    }
}

export default new CacheService();