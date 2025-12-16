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
    pgm.createType('order_product_status',
        ['waiting_for_product_arrival_in_opp', 'arrived_in_opp', 'sent_to_logistics', 'delivered', 'refunded']);

    pgm.createTable("order_product_statuses", {
        product_id: {
            type: 'integer',
            references: 'products(product_id)',
            onDelete: 'RESTRICT'
        },
        order_product_status: {
            type: 'order_product_status',
            default: 'waiting_for_product_arrival_in_opp'
        },
        count: {
            type: 'integer',
            notNull: true
        },
        date: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp')
        }
    })

};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('order_product_statuses');
    pgm.dropType('order_product_status');
};
