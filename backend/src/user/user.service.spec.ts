import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

describe('UserService', () => {
  let userService: UserService;
  const mockRepo = {
    save: jest.fn().mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      passwordHash: 'hash',
    }),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      passwordHash: 'hash',
    }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('should return an empty array when no users exist', async () => {
    const users = await userService.findAll();
    expect(users).toEqual([]);
    expect(mockRepo.find).toHaveBeenCalled();
  });

  it('should return a user by id', async () => {
    const user = await userService.findOne(1);
    expect(user).toEqual({
      id: 1,
      email: 'test@example.com',
      passwordHash: 'hash',
    });
    expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('should update a user', async () => {
    const dto = { name: 'New Name' };
    const result = await userService.update(1, dto as any);
    expect(result).toEqual({ affected: 1 });
    expect(mockRepo.update).toHaveBeenCalledWith(1, dto);
  });

  it('should remove a user', async () => {
    const result = await userService.remove(1);
    expect(result).toEqual({ affected: 1 });
    expect(mockRepo.delete).toHaveBeenCalledWith(1);
  });
});
