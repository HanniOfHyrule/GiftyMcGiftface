export interface JwtPayload {
  sub?: number;
  userId?: number;
  email?: string;
  iat?: number;
  exp?: number;
}
