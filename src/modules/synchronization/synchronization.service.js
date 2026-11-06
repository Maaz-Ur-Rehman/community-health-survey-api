
const crypto = require('node:crypto')
const { sequelize, ProcessedOp } = require('../../database/models')
const { AppError, ConflictError } = require('../../common/errors/AppError')
const logger = require('../../common/utils/logger')
const { applyEntityOperation } = require('./synchronization.operations')

// Produce a stable JSON representation regardless of object key order.
function canonicalize(value) {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(',')}]`
    }

    if (value && typeof value === 'object') {
        return `{${Object.keys(value)
            .sort()
            .map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
            .join(',')}}`
    }

    return JSON.stringify(value)
}

function getRequestHash(operation) {
    return crypto
        .createHash('sha256')
        .update(canonicalize(operation))
        .digest('hex')
}

// Check whether this operation was already processed.
function getReplay(existing, operation, user, requestHash) {
    if (existing.userId !== user.id) {
        throw new ConflictError(
            'Operation ID has already been used',
        )
    }

    const savedResult = existing.result || {}

    if (
        existing.entity !== operation.entity ||
        savedResult.clientId !== operation.clientId ||
        savedResult.requestHash !== requestHash
    ) {
        throw new ConflictError(
            'Operation ID was reused with a different request',
        )
    }

    const { requestHash: ignored, ...result } = savedResult

    return {
        ...result,
        status: 'replayed',
        replayed: true,
    }
}

// Process one operation atomically.
async function processOperation(operation, user) {
    const requestHash = getRequestHash(operation)

    try {
        return await sequelize.transaction(async transaction => {

            const existing = await ProcessedOp.findByPk(
                operation.opId,
                {
                    transaction,
                },
            )

            if (existing) {
                return getReplay(
                    existing,
                    operation,
                    user,
                    requestHash,
                )
            }

            // Create or update the actual business record.
            const result = await applyEntityOperation(
                operation,
                user,
                transaction,
            )

            // Save idempotency result in the SAME transaction.
            await ProcessedOp.create(
                {
                    opId: operation.opId,
                    userId: user.id,
                    entity: operation.entity,
                    result: {
                        ...result,
                        requestHash,
                    },
                },
                { transaction },
            )

            return result
        })
    } catch (err) {
        // Another request may have completed the same operation
        // while this request was waiting for a database lock.
        const existing = await ProcessedOp.findByPk(operation.opId)

        if (existing) {
            return getReplay(
                existing,
                operation,
                user,
                requestHash,
            )
        }

        throw err
    }
}

// Convert individual operation failures into results.
// A failed operation does not stop the rest of the batch.
function operationError(operation, err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
        return {
            opId: operation.opId,
            entity: operation.entity,
            action: operation.action,
            clientId: operation.clientId,
            status: 'conflict',
            error: {
                code: 'CONFLICT',
                message: 'A record with these values already exists',
            },
        }
    }

    if (err.name === 'SequelizeForeignKeyConstraintError') {
        return {
            opId: operation.opId,
            entity: operation.entity,
            action: operation.action,
            clientId: operation.clientId,
            status: 'rejected',
            error: {
                code: 'INVALID_REFERENCE',
                message: 'A referenced record does not exist',
            },
        }
    }

    if (err instanceof AppError) {
        return {
            opId: operation.opId,
            entity: operation.entity,
            action: operation.action,
            clientId: operation.clientId,
            status: err.statusCode === 409
                ? 'conflict'
                : 'rejected',
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        }
    }

    logger.error(
        { err, opId: operation.opId },
        'Synchronization operation failed',
    )

    return {
        opId: operation.opId,
        entity: operation.entity,
        action: operation.action,
        clientId: operation.clientId,
        status: 'rejected',
        error: {
            code: 'INTERNAL_ERROR',
            message: 'Operation could not be processed',
        },
    }
}

// Process batch sequentially.
// The mobile client should send parent records before child records.
async function pushOperations(operations, user) {
    const results = []

    for (const operation of operations) {
        try {
            const result = await processOperation(
                operation,
                user,
            )

            results.push(result)
        } catch (err) {
            results.push(operationError(operation, err))
        }
    }

    const summary = {
        received: results.length,
        applied: results.filter(
            item => item.status === 'applied',
        ).length,
        replayed: results.filter(
            item => item.status === 'replayed',
        ).length,
        conflicts: results.filter(
            item => item.status === 'conflict',
        ).length,
        rejected: results.filter(
            item => item.status === 'rejected',
        ).length,
    }

    return {
        results,
        summary,
    }
}

module.exports = {
    pushOperations,
}
