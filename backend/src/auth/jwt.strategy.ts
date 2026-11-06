import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './types/jwt-payload.type';
import { getJwtSecret } from './jwt-secrets';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  validate(payload: JwtPayload): { sub: number; email: string } {
    const userId =
      typeof payload.sub === 'number' ? payload.sub : payload.userId;

    if (typeof userId !== 'number') {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      sub: userId,
      email: payload.email ?? '',
    };
  }
}
