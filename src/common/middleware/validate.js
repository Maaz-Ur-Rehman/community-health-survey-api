// Parses req[source] with a zod schema. Express 5's req.query is read-only,
// so the cleaned data is stored on req.validated instead.
module.exports =
    (schema, source = 'body') =>
    (req, res, next) => {
        req.validated = {
            ...req.validated,
            [source]: schema.parse(req[source]),
        }
        next()
    }
