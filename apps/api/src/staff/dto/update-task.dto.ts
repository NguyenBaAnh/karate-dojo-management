export class UpdateTaskDto {
  title?: string;
  description?: string | null;
  ownerId?: string | null;
  dueAt?: string | null;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  priority?: number;
}
