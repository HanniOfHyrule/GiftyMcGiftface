import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { LoginResultDto } from './dto/login-result.dto';
import * as bcrypt from 'bcryptjs';
import { RegisterResultDto } from './dto/register-result.dto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { getJwtRefreshSecret } from './jwt-secrets';
import {
  loginAttemptsTotal,
  logoutsTotal,
  signupsTotal,
  tokenRefreshesTotal,
} from '../metrics/metrics';
import { metricDelta } from '../metrics/testing';

// bcrypt.compare ist überladen (Promise + Callback); als Mock typisieren,
// damit no-misused-promises nicht anschlägt.
const mockCompare = (matches: boolean) =>
  (jest.spyOn(bcrypt, 'compare') as unknown as jest.Mock).mockResolvedValue(
    matches,
  );

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    userRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    process.env.JWT_SECRET = 'x'.repeat(32);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should register any new email address', async () => {
    userRepo.findOne.mockResolvedValue(null);
    userRepo.create.mockReturnValue({});
    userRepo.save.mockResolvedValue({});
    const result = await service.register({
      email: 'test@example.com',
      password: 'pw',
      name: 'Test',
      lastName: 'User',
    });
    expect(result).toBeInstanceOf(RegisterResultDto);
    expect(result).toEqual({ message: 'Registrierung erfolgreich' });
  });

  it('should throw ForbiddenException if email already exists', async () => {
    userRepo.findOne.mockResolvedValue({});
    await expect(
      service.register({
        email: 'test@example.com',
        password: 'pw',
        name: 'Test',
        lastName: 'User',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should return login response for valid credentials', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 42,
      email: 'test@example.com',
      passwordHash: 'hashedpw',
      name: 'Max',
      lastName: 'Mustermann',
    });

    mockCompare(true);

    const result = await service.login('test@example.com', 'secret123');
    expect(result).toBeInstanceOf(LoginResultDto);
    if (result instanceof LoginResultDto) {
      expect(result.message).toBe('Login erfolgreich');
      expect(result.userId).toBe(42);
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Max');
      expect(result.lastName).toBe('Mustermann');
      expect(typeof result.token).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(userRepo.update).toHaveBeenCalled();
    } else {
      throw new Error('Expected LoginResultDto, got ErrorResultDto');
    }
  });

  it('should reject unknown emails with the same message as wrong passwords', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(
      service.login('unknown@example.com', 'secret123'),
    ).rejects.toThrow(new UnauthorizedException('Ungültige Zugangsdaten'));
  });

  describe('metrics', () => {
    const newUser = {
      email: 'test@example.com',
      password: 'pw',
      name: 'Test',
      lastName: 'User',
    };
    const storedUser = {
      id: 42,
      email: 'test@example.com',
      passwordHash: 'hashedpw',
      name: 'Max',
      lastName: 'Mustermann',
      refreshTokenHash: 'stored-hash',
    };
    const refreshToken = () => jwt.sign({ sub: 42 }, getJwtRefreshSecret());

    afterEach(() => jest.restoreAllMocks());

    it.each([
      ['success', null, undefined],
      ['duplicate', {}, undefined],
      ['invalid', null, { ...newUser, name: '' }],
    ])(
      'counts a %s signup',
      async (result, existing, dto: typeof newUser | undefined) => {
        userRepo.findOne.mockResolvedValue(existing);
        userRepo.create.mockReturnValue({});
        userRepo.save.mockResolvedValue({});
        const delta = await metricDelta(signupsTotal, { result }, () =>
          service.register(dto ?? newUser).catch(() => undefined),
        );
        expect(delta).toBe(1);
      },
    );

    it('counts a failing signup as error', async () => {
      userRepo.findOne.mockRejectedValue(new Error('db down'));
      const delta = await metricDelta(signupsTotal, { result: 'error' }, () =>
        service.register(newUser).catch(() => undefined),
      );
      expect(delta).toBe(1);
    });

    it.each([
      ['success', true],
      ['invalid', false],
    ])('counts a %s login', async (result, passwordMatches) => {
      userRepo.findOne.mockResolvedValue(storedUser);
      mockCompare(passwordMatches);
      const delta = await metricDelta(loginAttemptsTotal, { result }, () =>
        service.login('test@example.com', 'pw').catch(() => undefined),
      );
      expect(delta).toBe(1);
    });

    it('counts a login that fails for technical reasons as error', async () => {
      userRepo.findOne.mockRejectedValue(new Error('db down'));
      const delta = await metricDelta(
        loginAttemptsTotal,
        { result: 'error' },
        () => service.login('test@example.com', 'pw').catch(() => undefined),
      );
      expect(delta).toBe(1);
    });

    it('counts successful and invalid token refreshes', async () => {
      userRepo.findOne.mockResolvedValue(storedUser);
      mockCompare(true);
      expect(
        await metricDelta(tokenRefreshesTotal, { result: 'success' }, () =>
          service.refresh(refreshToken()),
        ),
      ).toBe(1);
      expect(
        await metricDelta(tokenRefreshesTotal, { result: 'invalid' }, () =>
          service.refresh('not-a-jwt').catch(() => undefined),
        ),
      ).toBe(1);
    });

    it('counts logouts', async () => {
      expect(
        await metricDelta(logoutsTotal, {}, () =>
          service.logout(refreshToken()),
        ),
      ).toBe(1);
    });
  });
});
