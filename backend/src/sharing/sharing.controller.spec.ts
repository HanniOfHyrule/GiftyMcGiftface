import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';

describe('SharingController', () => {
  const user = { sub: 7, email: 'anna@example.com' };
  let service: jest.Mocked<
    Pick<SharingService, 'list' | 'invite' | 'accept' | 'remove'>
  >;
  let controller: SharingController;

  beforeEach(() => {
    service = {
      list: jest.fn().mockResolvedValue({ outgoing: [], incoming: [] }),
      invite: jest.fn().mockResolvedValue({ id: 1 }),
      accept: jest.fn().mockResolvedValue({ id: 1 }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    controller = new SharingController(service as never);
  });

  it('reicht immer den eingeloggten User an den Service weiter', async () => {
    await controller.list(user);
    await controller.invite(user, { email: 'ben@example.com' });
    await controller.accept(user, 3);
    await controller.remove(user, 4);

    expect(service.list).toHaveBeenCalledWith(7);
    expect(service.invite).toHaveBeenCalledWith(7, 'ben@example.com');
    expect(service.accept).toHaveBeenCalledWith(7, 3);
    expect(service.remove).toHaveBeenCalledWith(7, 4);
  });
});
