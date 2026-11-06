import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { LoginResultDto } from './dto/login-result.dto';
import { RegisterResultDto } from './dto/register-result.dto';
import { ErrorResultDto } from './dto/error-result.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../user/entities/user.entity';
import * as jwt from 'jsonwebtoken';
import { getJwtRefreshSecret, getJwtSecret } from './jwt-secrets';
import {
  loginAttemptsTotal,
  logoutsTotal,
  signupsTotal,
  tokenRefreshesTotal,
} from '../metrics/metrics';

interface AccessTokenPayload {
  sub: number;
  email: string;
}

interface RefreshTokenPayload {
  sub: number;
}

@Injectable()
export class AuthService {
  // Vergleichshash für unbekannte E-Mails, damit die Antwortzeit beim Login
  // nicht verrät, ob ein Account existiert.
  private readonly dummyHash = bcrypt.hashSync('dummy-password', 10);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async register(
    createAuthDto: CreateAuthDto,
  ): Promise<RegisterResultDto | ErrorResultDto> {
    try {
      const { email, password, name, lastName } = createAuthDto;
      const existingUser = await this.userRepo.findOne({ where: { email } });
      if (existingUser) {
        signupsTotal.inc({ result: 'duplicate' });
        throw new ForbiddenException('E-Mail bereits registriert');
      }
      if (!email || !password || !name || !lastName) {
        signupsTotal.inc({ result: 'invalid' });
        throw new BadRequestException('Alle Felder müssen ausgefüllt sein');
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = this.userRepo.create({
        email,
        passwordHash,
        name,
        lastName,
      });
      await this.userRepo.save(user);
      signupsTotal.inc({ result: 'success' });
      return new RegisterResultDto('Registrierung erfolgreich');
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof ForbiddenException) {
        throw e;
      }
      signupsTotal.inc({ result: 'error' });
      throw new Error(e instanceof Error ? e.message : String(e));
    }
  }

  async login(
    email: string,
    password: string,
  ): Promise<LoginResultDto | ErrorResultDto> {
    try {
      const user = await this.userRepo.findOne({ where: { email } });
      const valid = await bcrypt.compare(
        password,
        user?.passwordHash ?? this.dummyHash,
      );
      if (!user || !valid) {
        loginAttemptsTotal.inc({ result: 'invalid' });
        throw new UnauthorizedException('Ungültige Zugangsdaten');
      }

      const token = this.createAccessToken(user);
      const refreshToken = this.createRefreshToken(user);
      await this.updateRefreshTokenHash(user.id, refreshToken);
      loginAttemptsTotal.inc({ result: 'success' });

      return new LoginResultDto(
        'Login erfolgreich',
        user.id,
        user.email,
        user.name,
        user.lastName,
        token,
        refreshToken,
      );
    } catch (e) {
      if (
        e instanceof BadRequestException ||
        e instanceof ForbiddenException ||
        e instanceof UnauthorizedException
      ) {
        throw e;
      }
      loginAttemptsTotal.inc({ result: 'error' });
      throw new Error(e instanceof Error ? e.message : String(e));
    }
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ token: string; refreshToken: string }> {
    try {
      const result = await this.rotateRefreshToken(refreshToken);
      tokenRefreshesTotal.inc({ result: 'success' });
      return result;
    } catch (e) {
      tokenRefreshesTotal.inc({
        result: e instanceof UnauthorizedException ? 'invalid' : 'error',
      });
      throw e;
    }
  }

  private async rotateRefreshToken(
    refreshToken: string,
  ): Promise<{ token: string; refreshToken: string }> {
    const payload = this.verifyRefreshToken(refreshToken);
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (typeof user.refreshTokenHash !== 'string') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await bcrypt.compare(
      refreshToken,
      String(user.refreshTokenHash),
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newAccessToken = this.createAccessToken(user);
    const newRefreshToken = this.createRefreshToken(user);
    await this.updateRefreshTokenHash(user.id, newRefreshToken);

    return {
      token: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = this.verifyRefreshToken(refreshToken);
    await this.userRepo.update(payload.sub, { refreshTokenHash: null });
    logoutsTotal.inc();
  }

  private createAccessToken(user: User): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
    };

    const secret: jwt.Secret = getJwtSecret();
    const expiresIn = (process.env.JWT_EXPIRES_IN ||
      '15m') as jwt.SignOptions['expiresIn'];

    return jwt.sign(payload, secret, {
      expiresIn,
    });
  }

  private createRefreshToken(user: User): string {
    const payload: RefreshTokenPayload = {
      sub: user.id,
    };

    const secret: jwt.Secret = getJwtRefreshSecret();
    const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ||
      '7d') as jwt.SignOptions['expiresIn'];

    return jwt.sign(payload, secret, {
      expiresIn,
    });
  }

  private async updateRefreshTokenHash(
    userId: number,
    refreshToken: string,
  ): Promise<void> {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.userRepo.update(userId, { refreshTokenHash });
  }

  private verifyRefreshToken(refreshToken: string): RefreshTokenPayload {
    try {
      const secret: jwt.Secret = getJwtRefreshSecret();
      const decoded = jwt.verify(refreshToken, secret);

      if (!decoded || typeof decoded !== 'object' || !('sub' in decoded)) {
        throw new UnauthorizedException('Invalid refresh token payload');
      }

      const rawSub = decoded.sub;
      const sub = typeof rawSub === 'number' ? rawSub : Number(rawSub);
      if (!Number.isInteger(sub) || sub <= 0) {
        throw new UnauthorizedException('Invalid refresh token payload');
      }

      return { sub };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
