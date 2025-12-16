import pg from "pg";

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.createTable('product_variants', {
        variant_group_id: {
            type: 'serial',
            primaryKey: true
        },
        fields: {
            type: 'jsonb', // в формате [
            // {"var""variantFieldName": "цвет", "variantFieldValues": ["красный", "желтый", "зеленый"]}
            // ]
            notNull: true
        }
    })

    pgm.addColumn('products', {
        count: {
            type: 'integer',
            notNull: true,
            default: 0
        },
        variant_group_id: {
            type: 'integer',
            references: 'product_variants(variant_group_id)',
            default: null,
            onDelete: 'SET NULL'
        },
        variant: {
            type: 'jsonb',
            default: '[]'
        },
        characteristics: {
            type: 'jsonb',
            default: '{}'
        }
    });

    pgm.createType('characteristic_type',
        ['color', 'options', 'int', 'float', 'bool']);

    pgm.createTable('category_characteristics', {
        characteristic_id: {
            type: 'serial',
            primaryKey: true
        },
        category_id: {
            type: 'integer',
            references: 'product_categories(category_id)',
            notNull: true,
            onDelete: 'CASCADE'
        },
        name: {
            type: 'varchar(256)',
            notNull: true
        },
        type: {
            type: 'characteristic_type',
            notNull: true
        },
        data: {
            type: 'jsonb',
            default: '{}'
        },
        allow_in_filter: {
            type: 'bool',
            notNull: true,
            default: false
        }

    })


};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {

    pgm.dropConstraint("category_characteristics", "category_characteristics_category_id_fkey")
    pgm.dropConstraint("products", "products_variant_group_id_fkey")
    // Удаляем таблицу CategoryCharacteristics
    pgm.dropTable('category_characteristics');
    pgm.dropTable('product_variants');

    // Удаляем тип characteristic_type
    pgm.dropType('characteristic_type');

    // Удаляем колонки из таблицы products
    pgm.dropColumns('products', [
        'count',
        'variant_group_index',
        'variant',
        'characteristics'
    ]);
};
