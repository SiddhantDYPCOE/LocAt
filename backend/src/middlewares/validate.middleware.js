const validate = (schema, source = "body") => {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req[source]);

      req.validated = req.validated || {};
      req.validated[source] = validatedData;

      next();
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message
          }))
        });
      }

      next(error);
    }
  };
};

export default validate;