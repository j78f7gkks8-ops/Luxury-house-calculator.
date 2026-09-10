const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error("JWT_SECRET не задан или слишком короткий — задайте переменную окружения JWT_SECRET (см. .env.example)");
}

export const env = {
  jwtSecret: JWT_SECRET,
  port: Number(process.env.PORT ?? 4000),
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
};
