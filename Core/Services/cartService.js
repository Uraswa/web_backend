import ProductModel from "../Model/ProductModel.js";

class CartService {

    _carts = {}; // Хранилище корзин в памяти: { userId: { items: [{product, quantity}], total } }

    constructor() {
        // Можно добавить периодическую очистку старых корзин
        setInterval(() => {
            this._cleanupOldCarts();
        }, 24 * 60 * 60 * 1000); // Раз в сутки
    }

    // Получение корзины с деталями товаров
    async getCartWithDetails(user_id) {
        try {
            const cart = this._carts[user_id];

            if (!cart || !cart.items || cart.items.length === 0) {
                return {
                    items: [],
                    total: 0
                };
            }

            // Получаем актуальные данные о товарах
            const itemsWithDetails = [];
            let total = 0;

            for (const item of cart.items) {
                try {
                    // Получаем актуальную информацию о товаре
                    const product = await ProductModel.findById(item.product_id);

                    if (product) {
                        const itemTotal = product.price * item.quantity;
                        total += itemTotal;

                        itemsWithDetails.push({
                            ...item,
                            product: {
                                product_id: product.product_id,
                                name: product.name,
                                price: product.price,
                                photos: product.photos,
                                description: product.description,
                                shop_name: product.shop_name,
                                category_name: product.category_name
                            },
                            total: itemTotal.toFixed(2)
                        });
                    }
                } catch (error) {
                    console.error(`Ошибка при получении товара ${item.product_id}:`, error);
                }
            }

            return {
                items: itemsWithDetails,
                total: total.toFixed(2),
                item_count: itemsWithDetails.length
            };
        } catch (error) {
            console.error('Ошибка в getCartWithDetails:', error);
            throw error;
        }
    }

    // Добавление товара в корзину
    async addToCart(user_id, productId, quantity = 1) {
        try {
            // Проверяем существование товара
            const product = await ProductModel.findById(productId);
            if (!product) {
                throw new Error('Товар не найден');
            }

            // Инициализируем корзину, если её нет
            if (!this._carts[user_id]) {
                this._carts[user_id] = {
                    items: [],
                    created_at: new Date(),
                    updated_at: new Date()
                };
            }

            const cart = this._carts[user_id];

            // Проверяем, есть ли уже товар в корзине
            const existingItemIndex = cart.items.findIndex(item => item.product_id == productId);

            if (existingItemIndex !== -1) {
                // Обновляем количество существующего товара
                cart.items[existingItemIndex].quantity += parseInt(quantity);

                // Если количество стало 0 или меньше, удаляем товар
                if (cart.items[existingItemIndex].quantity <= 0) {
                    cart.items.splice(existingItemIndex, 1);
                }
            } else {
                // Добавляем новый товар
                if (quantity > 0) {
                    cart.items.push({
                        product_id: parseInt(productId),
                        quantity: parseInt(quantity),
                        added_at: new Date()
                    });
                }
            }

            // Обновляем время изменения корзины
            cart.updated_at = new Date();

            return await this.getCartWithDetails(user_id);
        } catch (error) {
            console.error('Ошибка в addToCart:', error);
            throw error;
        }
    }

    // Обновление количества товара в корзине
    async updateCartItem(user_id, productId, quantity) {
        try {
            if (!this._carts[user_id]) {
                return {
                    items: [],
                    total: 0,
                    item_count: 0
                };
            }

            const cart = this._carts[user_id];
            const existingItemIndex = cart.items.findIndex(item => item.product_id == productId);

            if (existingItemIndex === -1) {
                return await this.getCartWithDetails(user_id);
            }

            if (quantity <= 0) {
                // Удаляем товар, если количество 0 или меньше
                cart.items.splice(existingItemIndex, 1);
            } else {
                // Обновляем количество
                cart.items[existingItemIndex].quantity = parseInt(quantity);
                cart.items[existingItemIndex].updated_at = new Date();
            }

            // Обновляем время изменения корзины
            cart.updated_at = new Date();

            return await this.getCartWithDetails(user_id);
        } catch (error) {
            console.error('Ошибка в updateCartItem:', error);
            throw error;
        }
    }

    // Удаление товара из корзины
    async removeFromCart(user_id, productId) {
        try {
            if (!this._carts[user_id]) {
                return {
                    items: [],
                    total: 0,
                    item_count: 0
                };
            }

            const cart = this._carts[user_id];
            const initialLength = cart.items.length;

            // Фильтруем массив, удаляя товар
            cart.items = cart.items.filter(item => item.product_id != productId);

            if (cart.items.length === initialLength) {
                throw new Error('Товар не найден в корзине');
            }

            // Обновляем время изменения корзины
            cart.updated_at = new Date();

            return await this.getCartWithDetails(user_id);
        } catch (error) {
            console.error('Ошибка в removeFromCart:', error);
            throw error;
        }
    }

    // Очистка корзины
    async clearCart(user_id) {
        try {
            if (!this._carts[user_id]) {
                return true
            }

            // Очищаем корзину
            this._carts[user_id].items = [];
            this._carts[user_id].updated_at = new Date();

            return true
        } catch (error) {
            console.error('Ошибка в clearCart:', error);
            throw error;
        }
    }

    // Получение простой информации о корзине (без деталей товаров)
    async getCartInfo(user_id) {
        try {
            const cart = this._carts[user_id];

            if (!cart || !cart.items || cart.items.length === 0) {
                return {
                    item_count: 0,
                    total_items: 0,
                    exists: false
                };
            }

            // Подсчет общего количества товаров
            const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

            return {
                item_count: cart.items.length,
                total_items: totalItems,
                exists: true,
                updated_at: cart.updated_at
            };
        } catch (error) {
            console.error('Ошибка в getCartInfo:', error);
            throw error;
        }
    }

    // Вспомогательный метод для очистки старых корзин
    _cleanupOldCarts() {
        try {
            const now = new Date();
            const OLD_CART_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 дней

            for (const userId in this._carts) {
                const cart = this._carts[userId];

                if (cart.updated_at) {
                    const lastUpdate = new Date(cart.updated_at);
                    const age = now - lastUpdate;

                    if (age > OLD_CART_THRESHOLD) {
                        delete this._carts[userId];
                    }
                } else if (cart.created_at) {
                    const created = new Date(cart.created_at);
                    const age = now - created;

                    if (age > OLD_CART_THRESHOLD) {
                        delete this._carts[userId];
                    }
                }
            }

            console.log(`Очистка корзин завершена. Осталось: ${Object.keys(this._carts).length} корзин`);
        } catch (error) {
            console.error('Ошибка при очистке старых корзин:', error);
        }
    }

    // Метод для отладки (получение всех корзин)
    _getAllCarts() {
        return this._carts;
    }

    // Метод для отладки (очистка всех корзин)
    _clearAllCarts() {
        this._carts = {};
        console.log('Все корзины очищены');
    }
}

export default new CartService();