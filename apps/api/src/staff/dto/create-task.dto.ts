export class CreateTaskDto {
  title!: string;
  description?: string;
  ownerId?: string;
  creatorId?: string;
  dueAt?: string;
  priority?: number;
}
