const successResponse = (res, statusCode = 200, message = 'Success', data = {}) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const errorResponse = (res, statusCode = 500, message = 'Error', errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

const paginatedResponse = (res, data, total, page, limit) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
      hasPrev: parseInt(page) > 1
    }
  });
};

module.exports = { successResponse, errorResponse, paginatedResponse };
