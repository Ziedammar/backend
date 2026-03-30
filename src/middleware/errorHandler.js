const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'File too large. Maximum size is 10MB.'
        });
    }
    
    if (err.message === 'Invalid file type. Only images are allowed.') {
        return res.status(400).json({
            error: err.message
        });
    }
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};

module.exports = { errorHandler };