import { Birthday } from './entities/birthday.entity';

export interface DuplicateGroup {
  name: string;
  lastName: string;
  entries: Birthday[];
  count: number;
}
