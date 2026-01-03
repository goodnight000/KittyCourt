const sendError = (res, statusCode, errorCode, message) => (
    res.status(statusCode).json({ errorCode, error: message })
);

const createHttpError = (message, statusCode, errorCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (errorCode) error.errorCode = errorCode;
    return error;
};

module.exports = {
    sendError,
    createHttpError,
};
