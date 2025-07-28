import { IsUUID } from 'class-validator';

export class IdDTO {
  @IsUUID()
  id: string;
}
